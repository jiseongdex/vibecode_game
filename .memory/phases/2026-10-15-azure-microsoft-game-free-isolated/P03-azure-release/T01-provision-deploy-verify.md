# Task: T01 Azure 독립 자원 생성·배포·실제 검증

## Status: done

## Goal

`CR-Project-01`의 기존 `grill-me-edu`에 새 SWA Free, Cosmos Free 400 RU/s, Azure 전용 Entra 앱 등록을 연결해 실제 HTTPS 게임을 제공하고 기존 Cloudflare 서비스를 그대로 확인한다.

## Decision Summary

- 새 자원만 만든다. 기존 `swa-grill-us-prod-d0d6`, Cloudflare Worker URL/D1, 기존 Entra 앱은 변경하지 않는다. Azure DB는 빈 상태에서 시작하며 복사·동기화하지 않는다.
- Cosmos Free 계정의 무료 할인은 **생성할 때만** 선택 가능하고 구독당 하나다. 현행 구독/지역/할인을 다시 읽고 확인되지 않으면 유료 계정을 생성하지 않는다. 무료 SWA와 Cosmos DB의 실사용량/서비스 제한은 배포 후 점검한다.

## Commit Scope Guard

`.memory/`는 로컬 전용으로 상태만 갱신하고 스테이징하지 않는다. 커밋 직전 index를 확인해 Cloudflare 관련 파일이나 다른 작업의 변경을 포함하지 않는다. 이 Task의 제품 문서/인프라 파일만 명시적 pathspec으로 커밋한다.

## Implementation

### I01. 배포 인프라 계약 및 문서

- Related Files:
  - `azure/infra/game-index-policy.json` :: `indexingPolicy` — new
  - `docs/azure-deployment.md` :: 계정·리소스·설정·복구·운영 절차 — new
  - `README.md` :: 기존 Cloudflare 안내 확인 — read-only
  - `docs/deployment.md` :: 기존 Cloudflare 문서 — read-only
  - `wrangler.jsonc`, `migrations/*` :: 기존 배포 보호 — read-only

#### Details

- **Resource schema**:
  - 구독 `CR-Project-01`, RG `grill-me-edu`, 새 SWA 이름 `maze-rescue-ms-game` (사용 중이면 다른 고유 이름을 사용하고 기록), SKU `Free`, SWA 호스팅 지역은 해당 서비스가 지원하는 아시아 지역(우선 `eastasia`)을 실제 허용 목록에서 확인한다. RG 위치와 서비스 호스팅 지역은 달라도 같은 RG에 들어간다.
  - 새 Cosmos for NoSQL 계정 이름은 Azure 전역에서 고유한 `maze-rescue-ms-<suffix>`로 선택, 지역 `koreacentral` 우선, `enableFreeTier=true`, 한 지역, autoscale/serverless/multi-region 비활성. DB `maze-rescue`의 공유 **manual 400 RU/s**. 컨테이너 `game`, `auth`는 각각 `/scope`, `defaultTtl=-1`, **컨테이너별 throughput 설정 없음**.
  - `game` indexing policy: 기본 포함 `/*`에 더해 `highestStage DESC`, `rankTimeSeconds ASC`, `id ASC`의 composite index. 이 순서와 `topUsers`의 ORDER BY가 동일해야 한다. `auth`는 기본 인덱스. `game`의 UserDoc에는 ttl을 넣지 않고 AttemptDoc만 문서별 ttl; `auth`의 세션/flow에는 문서별 ttl.
  - Azure SWA API 앱 설정 이름: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `PUBLIC_ORIGIN`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`. 값은 Azure 환경 설정에만 저장한다. `PUBLIC_ORIGIN`은 새 SWA `https://<default-hostname>`이며 callback은 `${PUBLIC_ORIGIN}/api/auth/microsoft/callback`.
  - Entra 앱 등록: 대상 계정 `Accounts in any organizational directory and personal Microsoft accounts`; 플랫폼 `Web`; redirect URI는 정확한 새 Azure callback; scope `openid profile`; 클라이언트 secret 만료일 기록. Entra 앱은 RG 리소스가 아니라 테넌트 객체이며, 등록 권한이 없으면 권한 있는 계정으로 사용자 인증을 받아야 한다.
- `docs/azure-deployment.md`에 읽기 전용 확인 → 새 자원 생성 → 앱 등록 → 앱 설정 → 정적/API 배포 → 실제 검증 → 비밀값 교체/재배포 흐름을 적는다. secret 값, Cosmos key, SWA 배포 토큰을 파일·커밋·채팅·명령 인수에 노출하지 않는다. Azure CLI가 기존 자격 저장소에 접근할 수 없으면 `AZURE_CONFIG_DIR`을 이 작업 전용 로컬 비추적 디렉터리로 지정하고 대화형 로그인 후 대상 구독을 재확인한다.

### I02. 생성·배포 절차

- Related Files:
  - `docs/azure-deployment.md` :: 실제 자원 이름/URL/검증 결과 추가 — modify
  - `azure/infra/game-index-policy.json` :: Cosmos CLI `--idx @...` 입력 — new
  - `azure/api/*`, `dist/*` :: 빌드 산출물만 사용 — read-only

#### Details

- **Execution Flow / Logic**:
  1. `az account show --query "{name:name,id:id}"`, `az group show -n grill-me-edu`, `az cosmosdb list --query "[?enableFreeTier==\`true\`]"`, `az staticwebapp list -g grill-me-edu`로 구독·기존 자원을 확인한다. CLI 출력에 인증 비밀을 포함하지 않는다. 구독이 다르면 `az account set --subscription CR-Project-01` 후 다시 읽는다. Free slot, RG, 이름 사용 여부를 재확인한다.
  2. 문서화한 순서로 `az staticwebapp create -n maze-rescue-ms-game -g grill-me-edu -l eastasia --sku Free`를 실행하고 default hostname을 읽는다. GitHub 소스 연결 없이 새 빈 앱을 만든다. 기존 SWA ID가 대상 이름으로 조회되면 무작정 덮어쓰지 않는다.
  3. `az cosmosdb create`에 계정 이름/RG, `--locations regionName=koreacentral failoverPriority=0`, `--enable-free-tier true`를 명시한다. 성공 후 `az cosmosdb show`의 `enableFreeTier=true`, 위치 1개, NoSQL 계정을 검증한다. `az cosmosdb sql database create -a <account> -g grill-me-edu -n maze-rescue --throughput 400`; `az cosmosdb sql container create` 두 번에 DB/이름/`-p /scope`/`--ttl -1`을 주고 **`--throughput` 옵션은 주지 않는다**. `game` 생성에는 `--idx @azure/infra/game-index-policy.json`. DB throughput 조회 결과 400, 각 컨테이너의 전용 throughput이 없음을 확인한다.
  4. 정확한 Azure callback URL이 확보된 뒤 Entra 앱을 새로 등록한다. 사용자 본인/조직 로그인 승인이나 관리자 동의가 필요하면 그 계정의 승인 절차를 거친다. 생성된 app/client ID만 문서화하고 client secret 값은 앱 설정에만 보관한다. Cosmos 키도 Azure 앱 설정에만 둔다. Portal 입력 또는 마스킹된 안전한 입력 경로를 사용하며 `az staticwebapp appsettings list` 전체 출력으로 비밀값을 노출하지 않는다.
  5. `npm.cmd test -- --run`, `npm.cmd run lint`, `npm.cmd run lint:azure-api`, `npm.cmd run build:azure-api`, `npm.cmd run build:azure`를 통과한다. SWA CLI `swa deploy ./dist --api-location ./azure/api --env production`을 **새 앱의 배포 토큰**으로 실행한다. 토큰은 프로세스 인수/출력 대신 비추적 환경 변수 `SWA_CLI_DEPLOYMENT_TOKEN`으로 공급한다. CLI가 API를 패키징하지 못하면 P01-T04의 staging 절차를 실행한 뒤 재시도한다. Cloudflare `npm run deploy`/`wrangler deploy`는 실행하지 않는다.
  6. 로그인/게임 live smoke를 마친 뒤 `docs/azure-deployment.md`에 실제 Azure 기본 URL, Cosmos/SWA 이름, Entra client ID, 날짜, 계정 종류별 성공/실패, 앱 secret 만료 **날짜만** 기록한다. PIN/secret/토큰/개인 이메일 주소는 기록하지 않는다. 운영 테스트용 사용자/기록을 임의 삭제하지 않는다.
- **Error handling**: Free 할인 사용 중이거나 SWA Free/region 미지원, Entra 등록 권한 부재, 쿠키 전달 실패, Cosmos 429 발생 시 유료 SKU·RU 증설로 자동 우회하지 않는다. 원인과 현재 생성된 자원/검증 상태를 문서화하고 해결 가능한 범위의 안전한 구성/코드 수정 후 재검증한다. 불완전 배포를 완료로 표시하지 않는다.

### I03. 실제 동작 및 비용 경계 확인

- Related Files:
  - `docs/azure-deployment.md` :: smoke 표·운영 확인 — modify
  - `src/api/contracts.ts`, `worker/index.ts` :: 비교 기준; read-only

#### Details

- Azure URL에서 `/` 200 및 Microsoft 화면, 이전 `/microsoft`의 `/` 리디렉션, `/simple`에서 PIN UI 없음, `/api/health` 200, 비로그인 `/api/me`·`/api/leaderboard` 401, `/api/auth/simple/login` 404를 확인한다. 로그인 성공·실패 콜백도 `/`로 돌아오게 한다.
- 실제 Microsoft **개인 계정과 조직 계정** 각각에서 로그인, 표시 이름, 세션 쿠키, 새로고침/재로그인, 로그아웃 후 401을 확인한다. 조직의 동의 정책 때문에 막히면 Entra 오류 코드를 기록하고 계정 소유자의 관리 승인 절차를 진행한다. 성공 콜백의 OAuth 쿠키 삭제와 세션 쿠키 설정이 둘 다 브라우저에서 보이는지 확인한다.
- 한 계정에서 1단계 완료 → 2단계 해금 → 다른 기기/브라우저에서 진행·최고 시간 복원, 두 계정의 최고 단계/시간 랭킹 및 내 순위, 비정상 시간/중복 완료 거부를 확인한다. 기존 로컬 Cloudflare 기록은 Azure에 나타나지 않는다.
- 읽기 전용으로 기존 Cloudflare `https://maze-rescue-game.maze-rescue-game.workers.dev/simple` 및 `/api/health`와 D1 자원 ID/행수 또는 지표를 배포 전후 비교한다. 간편 로그인의 기존 사용자 데이터를 시험/삭제하지 않는다. Azure 리소스는 SKU Free, Cosmos 계정 Free, DB 400 RU/s/한 지역/전용 RU 없음 확인. Cosmos RU·저장량과 SWA 무료 한도를 문서화한다.

## Acceptance Criteria

- [x] Azure URL의 공개 경로·API와 조직 계정 두 명의 로그인·분리 저장·한 명의 1단계 기록을 확인했다. 개인 계정 실로그인과 일부 실서비스 게임·랭킹 흐름은 아래의 승인된 검증 제한으로 기록했다.
- [x] Cosmos Free 할인, 단일 공유 DB 400 RU/s, SWA Free가 읽기 값으로 확인됐다.
- [x] 기존 Cloudflare Worker/D1 및 기존 Azure SWA에 변경·재배포 명령을 실행하지 않았고 공개 경로와 리소스 바인딩을 재확인했다. D1 원격 행 수는 CLI 인증 오류로 비교하지 못했다.
- [x] 배포 문서에 실제 URL·비용 경계·secret 교체 절차·검증 결과와 미검증 범위가 있고 비밀값은 없다.

## Approved Verification Limit (2026-10-15)

사용자에게 실제 개인 Microsoft 계정이 없어 실계정 로그인 검증을 수행하지 못했다. 사용자는 이를 미검증으로 명시하고 이번 배포를 완료하는 방식을 선택했다. Entra 앱의 개인·조직 계정 허용 설정과 OIDC 자동 테스트는 확인했다. 조직 계정의 실제 랭킹 화면·다른 브라우저 복원·콜백 쿠키 및 D1 원격 행 수 등 직접 확인하지 못한 항목도 문서에 따로 표시한다. 이 항목들의 동작을 실서비스 검증 완료로 주장하지 않는다.

## Validation

- `npm.cmd test -- --run` — 전체 회귀 테스트 통과
- `npm.cmd run lint` 및 `npm.cmd run lint:azure-api` — 브라우저/서버 타입 검사 통과
- `npm.cmd run build:azure-api` 및 `npm.cmd run build:azure` — 두 Azure 산출물 생성
- `az staticwebapp show -n maze-rescue-ms-game -g grill-me-edu --query "{sku:sku.name,host:defaultHostname}"` — Free와 URL 확인
- `az cosmosdb show -n <new-account> -g grill-me-edu --query "{free:enableFreeTier,locations:locations}"` 및 `az cosmosdb sql database throughput show -a <new-account> -g grill-me-edu -d maze-rescue` — Free/단일 지역/400 RU/s 확인
- 실제 HTTPS smoke 결과를 `docs/azure-deployment.md`에 기록 — 인증, 게임, 랭킹, Cloudflare 무변경 확인

## Commit Message

```text
docs(azure): 독립 Microsoft 게임 배포와 운영 검증 기록

Plan: 2026-10-15-azure-microsoft-game-free-isolated
Phase: P03-azure-release
Task: T01-provision-deploy-verify

- 새 Azure Free 자원과 Entra 앱을 연결해 실제 게임 배포
- Cosmos 400 RU/s와 확인된 로그인·기록, 미검증 범위 문서화
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (사용자가 승인한 실사용 검증 제한은 위에 명시)
- commit: `5d798d1` (Azure 기본 주소 전환 코드: `0c223ea`)
- 새 SWA Free `maze-rescue-ms-game`, Cosmos Free `maze-rescue-ms-b7af62a9`(공유 400 RU/s), Azure 전용 Entra 앱 생성 및 production 배포 완료.
- HTTPS 기본 경로·비로그인 API·조직 계정 1단계 기록 확인. Cosmos에는 서로 다른 조직 계정 사용자 2명이 저장됐다. 개인 Microsoft 계정의 실제 로그인은 아직 확인 중이다.
- 기존 Cloudflare 공개 주소와 기존 Azure SWA 읽기 값 유지. 기존 D1 원격 행 수는 Wrangler 인증 오류로 미확인.
- Azure 기본 주소 로그인 변경을 배포하고 `/` 200, 이전 `/microsoft`와 `/microsoft/` 301, 실패 콜백 `/?error=login_failed` 302를 확인했다. 코드·테스트·설정의 중간 커밋은 `0c223ea`다. 개인 Microsoft 계정의 실제 로그인 검증은 계속 대기 중이다.
- 개인 테스트 계정이 없어서 실로그인 검증을 생략하고 제한을 기록한 채 완료하는 방식을 사용자가 선택했다. Azure 배포 문서와 인덱스 정책을 `5d798d1`로 커밋했다.
