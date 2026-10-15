# 독립 Azure Microsoft 게임 배포

## 대상과 경계

- 구독: `CR-Project-01` (`b7af62a9-9a10-4deb-95fa-1690f7bbd33d`)
- 리소스 그룹: `grill-me-edu` (`koreacentral`)
- 새 Static Web App: `maze-rescue-ms-game`, Free, 호스팅 지역 `eastasia`
- 새 Cosmos DB for NoSQL: `maze-rescue-ms-b7af62a9`, `koreacentral`, 생성 시 Free 할인 적용
- 새 Entra 앱: 개인 Microsoft 계정과 모든 조직 계정 허용, Web 콜백 사용
- 새 게임 주소: https://proud-plant-07c59e200.6.azurestaticapps.net
- 새 Entra Application (client) ID: `a8c76562-6240-4a87-81b5-a57836f99d03`

기존 `swa-grill-us-prod-d0d6`와 Cloudflare Worker/D1은 이 배포에서 변경하지 않는다. Azure 계정은 빈 DB에서 시작한다. Azure Static Web App의 정적 게임과 관리형 Functions API는 같은 HTTPS origin을 사용한다.

## 1. 배포 전 읽기 전용 확인

CLI가 기본 자격 저장소에 접근할 수 없으면, Git에서 무시하는 `tmp/azure-cli`를 `AZURE_CONFIG_DIR`로 지정하고 디바이스 로그인한다. 여기에는 로그인 캐시가 남으므로 공유하거나 커밋하지 않는다.

```powershell
New-Item -ItemType Directory -Force tmp/azure-cli | Out-Null
$env:AZURE_CONFIG_DIR=(Resolve-Path tmp/azure-cli).Path
az login --use-device-code
az account set --subscription CR-Project-01
az account show --query "{name:name,id:id}"
az group show -n grill-me-edu --query "{name:name,location:location}"
az cosmosdb list --query "[].{name:name,free:enableFreeTier}" -o table
az staticwebapp list -g grill-me-edu --query "[].{name:name,sku:sku.name,host:defaultHostname}" -o table
```

`CR-Project-01`에 Free Cosmos 계정이 이미 있거나 조회 결과를 확신할 수 없다면 유료 계정을 자동 생성하지 않는다. 기존 이름과 자원 ID를 먼저 대조한다. 구독의 서비스 할당량과 허용 지역도 확인한다. `grill-me-edu`의 기존 SWA 이름은 `swa-grill-us-prod-d0d6`이며 이 이름으로 생성·수정·배포 명령을 실행하지 않는다.

## 2. 새 Static Web App과 Cosmos DB

다음 명령은 **새 이름의 자원이 없고** 대상 구독이 정확할 때만 실행한다. Cosmos 계정 이름은 Azure 전역에서 고유한 소문자 이름으로 정한다. 생성 결과의 `enableFreeTier`가 `true`가 아니면 뒤의 DB·컨테이너를 만들지 않는다.

```powershell
az staticwebapp create -n maze-rescue-ms-game -g grill-me-edu -l eastasia --sku Free
az staticwebapp show -n maze-rescue-ms-game -g grill-me-edu --query "{sku:sku.name,host:defaultHostname,location:location}"

$cosmosName='maze-rescue-ms-b7af62a9'
az cosmosdb create -n $cosmosName -g grill-me-edu --locations regionName=koreacentral failoverPriority=0 --enable-free-tier true --kind GlobalDocumentDB --default-consistency-level Session
az cosmosdb show -n $cosmosName -g grill-me-edu --query "{free:enableFreeTier,kind:kind,locations:locations[].locationName}"
az cosmosdb sql database create -a $cosmosName -g grill-me-edu -n maze-rescue --throughput 400
az cosmosdb sql container create -a $cosmosName -g grill-me-edu -d maze-rescue -n game -p /scope --ttl -1 --idx @azure/infra/game-index-policy.json
az cosmosdb sql container create -a $cosmosName -g grill-me-edu -d maze-rescue -n auth -p /scope --ttl -1
az cosmosdb sql database throughput show -a $cosmosName -g grill-me-edu -n maze-rescue
az cosmosdb sql container throughput show -a $cosmosName -g grill-me-edu -d maze-rescue -n game
az cosmosdb sql container throughput show -a $cosmosName -g grill-me-edu -d maze-rescue -n auth
```

DB의 수동 공유 처리량은 400 RU/s여야 한다. 컨테이너 처리량 조회의 `NotFound`는 전용 RU 자원이 없음을 뜻한다. 두 컨테이너 모두 `/scope` 파티션 키와 `defaultTtl=-1`을 쓴다. `game`의 `UserDoc`에는 TTL을 넣지 않고 시도 문서에만 TTL을 넣는다. `auth`의 OAuth 흐름과 세션 문서에도 문서별 TTL을 둔다. `game` 복합 인덱스는 랭킹의 `highestStage DESC, rankTimeSeconds ASC, id ASC` 정렬과 일치해야 한다.

## 3. Azure 전용 Entra 앱 등록과 비밀값

새 SWA의 기본 호스트를 확인한 후 Entra **앱 등록 → 새 등록**에서 지원 계정을 **모든 조직 디렉터리의 계정 및 개인 Microsoft 계정**으로 지정한다. 플랫폼은 **Web**, redirect URI는 `https://<새 SWA 기본 호스트>/api/auth/microsoft/callback`이다. 로그인 scope는 `openid profile`이다. 앱 등록은 Entra 테넌트 객체이며 리소스 그룹 안의 웹앱과 별개다. 기존 앱 등록을 수정하지 않는다.

클라이언트 secret을 발급하고 **만료 날짜만** 운영 기록에 적는다. 아래 앱 설정의 값은 새 SWA의 **환경 변수**에만 입력한다. Cosmos key, Entra secret, SWA 배포 토큰의 실제 값을 소스·문서·채팅·명령 인수·출력에 남기지 않는다. 설정 목록을 값까지 출력하는 CLI 명령도 사용하지 않는다. 이번 배포에서는 비추적 임시 PowerShell 스크립트가 두 비밀값을 메모리에서 받아 Azure 관리 API에 전송했고, 스크립트는 사용 후 제거했다.

| 설정 이름 | 값의 출처 |
| --- | --- |
| `COSMOS_ENDPOINT` | 새 Cosmos 계정의 HTTPS document endpoint |
| `COSMOS_KEY` | 새 Cosmos 계정의 primary key |
| `PUBLIC_ORIGIN` | 새 SWA의 `https://<defaultHostname>` |
| `MICROSOFT_CLIENT_ID` | 새 Entra 앱의 Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | 새 Entra 앱의 client secret **값** |

`PUBLIC_ORIGIN`과 Entra redirect URI의 호스트·경로가 정확히 일치해야 한다. 등록 권한이나 조직 사용자 동의 정책이 막히면 권한 있는 계정의 승인을 받아야 한다.

## 4. 빌드와 배포

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run lint:azure-api
npm.cmd run build:azure-api
npm.cmd run build:azure
```

`dist/staticwebapp.config.json`에는 SPA 경로 재작성, `/api/*` 제외, Node 20 관리형 Functions 런타임이 있어야 한다. SWA CLI는 비추적 `tmp/swa-cli`에 설치한다. 배포 대상은 **새 앱**인지 다시 확인한다. Azure Portal에서 새 앱의 배포 토큰을 비공개로 복사해 현재 셸의 `SWA_CLI_DEPLOYMENT_TOKEN` 환경 변수에 넣고 다음 명령을 실행한다. 토큰 값을 인수로 전달하지 않는다.

```powershell
npm.cmd install --prefix tmp/swa-cli --no-audit --no-fund @azure/static-web-apps-cli
& ./tmp/swa-cli/node_modules/.bin/swa.cmd deploy ./dist --api-location ./azure/api --api-version 20 --env production
```

CLI가 TypeScript Functions를 패키징하지 못하면 `azure/api`의 빌드된 `dist`, `host.json`, `package.json`, 배포에 필요한 런타임 의존성만 비추적 staging 폴더에 복사해 API 위치로 지정한다. 운영 배포 로그와 `/api/health`로 API 포함 여부를 확인한다. Cloudflare의 `npm run deploy`나 `wrangler deploy`는 실행하지 않는다.

## 5. 실제 HTTPS 점검

| 점검 | 기대 결과 | 실제 결과 |
| --- | --- | --- |
| `/` | 200, Microsoft 로그인 화면 | 200 HTML, 새 Azure 번들 `index-BKFjneWN.js` 확인; 화면 분기는 로컬 테스트 통과 |
| 이전 `/microsoft`, `/microsoft/` | `/`로 이동 | 둘 다 301, 기본 주소로 이동 확인 |
| `/simple` | PIN 가입·로그인 UI 없음 | 200 HTML; PIN 화면 차단은 로컬 테스트 통과, 실제 브라우저 미확인 |
| `/api/health` | 200 JSON | 200 `{"status":"ok"}` |
| 비로그인 `/api/me`, `/api/leaderboard` | 401 JSON | 모두 401 JSON |
| `POST /api/auth/simple/login` | 404 JSON | 404 JSON |
| `/api/auth/microsoft/start` | 302 Microsoft 인증으로 이동 | 302, `login.microsoftonline.com`, OAuth 쿠키 발급 |
| 인증 실패 콜백 | `/`로 이동해 오류 표시 | 302 `/?error=login_failed` 확인 |
| 개인 Microsoft 계정 로그인·표시 이름·로그아웃 | 정상 로그인, 로그아웃 뒤 401 | 실사용 계정이 없어 미검증. Entra 지원 계정 설정과 OIDC 단위 테스트만 확인 |
| 조직 계정 로그인·표시 이름 | 정상 로그인 또는 동의 오류 코드 기록 | 사용자가 서로 다른 두 계정의 게임 화면을 확인; Cosmos에 서로 다른 조직 계정 사용자 2명 저장 확인 |
| 로그인 콜백 쿠키 | OAuth 일회용 쿠키 삭제, 세션 쿠키 설정 | 미검증 |
| 1단계 완료·2단계 해금·다른 브라우저 복원 | 서버 기록 유지 | 미검증 |
| 두 계정의 랭킹·내 순위 | 최고 단계, 해당 단계 최단 시간 순서 | 미검증 |
| 비정상 시간·중복 완료 | API 거부 | 미검증 |
| 기존 Cloudflare `/simple`·`/api/health` | 배포 전후 기존 동작 유지 | 배포 전후 둘 다 200, health `{"status":"ok"}`·HTML 길이 551 동일 |
| 기존 D1 ID·행 수 | 배포 전후 동일 | D1 바인딩 ID 유지; 원격 행 수는 Wrangler OAuth 오류 10000으로 미확인 |

운영 데이터나 기존 간편 로그인 계정을 시험용으로 수정·삭제하지 않는다. 개인/조직 계정의 동의 정책 오류는 코드와 테스트 계정 **종류만** 기록한다. PIN·이메일·토큰은 기록하지 않는다.

### 검증 범위와 남은 확인

개인 Microsoft 테스트 계정이 없어 실제 개인 계정 로그인은 확인하지 못했다. Entra 앱의 `AzureADandPersonalMicrosoftAccount` 허용 범위와 정확한 Azure callback, OIDC 검증 자동 테스트까지 확인한 상태다. 사용자는 이 제한을 기록한 상태로 이번 배포를 완료하기로 선택했다. 개인 계정 로그인 성공·표시 이름·로그아웃 및 조직 계정과의 랭킹 분리는 개인 계정으로 나중에 확인해야 한다. 조직 계정 두 명의 분리 저장과 한 명의 1단계 완료 기록은 Cosmos 집계로 확인했으나, 콜백 쿠키·다른 브라우저 복원·랭킹 화면·비정상 시간 거부는 실서비스에서 직접 확인하지 못했다. 기존 D1의 원격 행 수도 Wrangler 인증 오류로 확인하지 못했다. 이 항목들을 실사용 검증 완료로 해석하지 않는다.

## 6. 운영과 비용 경계

- Cosmos Free 할인은 계정 생성 시에만 켤 수 있고 구독당 한 계정이다. 계정 전체에서 첫 1,000 RU/s와 25 GB까지 할인되며, 이를 넘는 처리량·저장량은 과금될 수 있다. 이 배포는 공유 DB 400 RU/s, 단일 지역, 전용 컨테이너 RU 없음으로 유지한다. [Microsoft 무료 계층 문서](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier)
- SWA Free의 문서상 월 포함 대역폭은 100 GB이고 단일 환경 저장량은 250 MB다. 관리형 API의 시간·요청 제한과 계정 할당량을 운영 중 확인한다. 한도에 도달하면 서비스가 제한될 수 있으므로 유료 SKU로 자동 변경하지 않는다. [Microsoft SWA 할당량](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas)
- Cosmos 메트릭에서 RU 소비량·429·저장량을, SWA 메트릭에서 대역폭과 API 오류를 점검한다. 비용 경고와 예산은 구독 운영자가 설정한다.
- 이번 Cosmos 계정은 분석 저장소와 다중 지역 쓰기를 끄고 Periodic/Local 백업을 사용한다. 현재 백업 간격은 4시간, 보존 기간은 8시간이다. 더 긴 복구 지점이 필요하면 백업 정책과 비용을 먼저 검토한다.
- Entra client secret 만료 전에 새 값을 만들고 새 SWA 환경 변수에 교체한 뒤 개인·조직 로그인과 로그아웃을 재검증한다. Cosmos key를 교체할 때도 새 SWA 설정만 갱신하고 API 동작을 재검증한다. 배포 토큰은 Azure Portal에서 재발급하고 이전 토큰을 폐기한다.
- 재배포는 해당 커밋의 Azure 빌드와 새 SWA 토큰만 사용한다. 실패 시 이전에 정상 동작한 아티팩트로 새 SWA만 다시 배포한다. Cosmos 데이터 복구는 별도 백업·복원 정책과 계정 권한을 확인한 뒤 수행한다.

## 2026-10-15 작업 기록

- `CR-Project-01`과 `grill-me-edu`를 읽기 전용으로 확인했다. 리소스 그룹 위치는 `koreacentral`이다.
- 작업 시작 전 기존 `swa-grill-us-prod-d0d6`는 Free/East Asia이고 새 `maze-rescue-ms-game`은 없었다. 새 앱을 만든 뒤 기존 앱 이름·기본 주소·SKU가 유지됨을 재확인했다.
- 작업 시작 전 조회된 Cosmos 계정 5개는 모두 `enableFreeTier=false`였다. 새 `maze-rescue-ms-b7af62a9` 계정은 Free 할인을 켜서 생성했고 `enableFreeTier=true`를 확인했다.
- `maze-rescue-ms-b7af62a9` 이름의 전역 중복 여부를 생성 전에 확인했다.
- 첫 Azure 계정에서는 `Microsoft.Web/staticSites/write` 권한 부족으로 생성이 거부됐다. 대상 RG의 Owner 권한이 있는 다른 계정으로 전환한 뒤 새 SWA를 Free/East Asia로 생성했다. 기존 SWA는 변경하지 않았다.
- 새 Cosmos 계정의 `enableFreeTier=true`, NoSQL, Korea Central 한 지역을 확인했다. `maze-rescue` DB의 공유 수동 처리량은 400 RU/s이고 autoscale 설정이 없다. `game`·`auth`의 전용 처리량 조회는 각각 `NotFound`로, 전용 RU가 없다. 두 컨테이너의 `/scope`와 `defaultTtl=-1`, `game`의 3열 복합 인덱스를 확인했다.
- Azure 전용 Entra 앱의 개인·모든 조직 계정 허용과 Web callback `https://proud-plant-07c59e200.6.azurestaticapps.net/api/auth/microsoft/callback`을 읽기로 확인했다. 새 SWA의 API 앱 설정 이름 5개를 확인했다. Entra client secret 만료일은 **2027-10-15 UTC**다.
- SWA CLI 2.0.10으로 정적 게임과 Node 20 API를 새 SWA production 환경에 배포했다. 새 SWA의 repository/branch 연결은 둘 다 없다. 로그인 주소 통일 후 재배포된 HTML은 `index-BKFjneWN.js`와 `index-BTX6qlh7.css`를 참조한다. 공개 경로와 비로그인 API 응답을 실제 HTTPS에서 확인했다.
- 새 Cosmos에서 개인 식별 값을 출력하지 않고 집계한 결과 사용자 2명(모두 조직 계정), 1단계 이상 완료 사용자 1명, 완료된 시도 1건이다. 사용자가 서로 다른 두 계정의 게임 화면을 확인했고, 두 계정이 별도 사용자로 저장됐다. 테스트할 개인 Microsoft 계정이 없어 개인 계정 로그인은 실사용 검증 전이다.
- 기존 Cloudflare의 `/api/health`는 200 `{"status":"ok"}`, `/simple`은 200 HTML이었다. 기존 D1 바인딩 ID는 `14d9c244-5db2-45c5-b9e9-2d9278e8a419`이다. 원격 D1 읽기는 현재 Wrangler OAuth 인증 오류 10000으로 실패했으며, D1 데이터는 변경하지 않았다.
- Azure 배포 뒤 기존 Cloudflare 두 공개 주소를 다시 읽었고 health 200/본문, `/simple` 200/HTML 길이가 배포 전과 같았다. 기존 Azure SWA도 `swa-grill-us-prod-d0d6`, Free/East Asia, 기존 기본 호스트 그대로였다. 기존 D1 원격 행 수는 Wrangler 인증 오류로 읽지 못했으므로 DB 내용의 동일성은 CLI로 재검증하지 못했다.
- Azure 주소를 기본 URL 하나로 단순화했다. 로그인 성공·실패 뒤의 이동 대상은 `/`이며, 예전 `/microsoft`와 `/microsoft/`는 301로 `/`에 연결된다. 새 버전 배포 뒤 기본 주소 200, 두 이전 경로 301, 인증 실패 콜백 302 `/?error=login_failed`, `/api/health` 200, 비로그인 `/api/me` 401을 실제 HTTPS에서 확인했다. 기존 Cloudflare의 `/simple`과 `/api/health`도 둘 다 200으로 유지됐다.
- 주소 통일 후 `npm.cmd test -- --run`의 38개 파일·251개 테스트, 브라우저와 Azure API 타입 검사, Azure 정적·API 빌드가 통과했다. 개인 계정의 실제 로그인, 브라우저의 콜백 쿠키, 계정 간 랭킹과 로그아웃은 단위 테스트 외 실서비스 수동 검증이 남아 있다.
