# Cloudflare Workers + D1 배포

## 현재 상태

2026-10-06 기준 Cloudflare CLI를 배포 계정에 연결하고 원격 D1 `maze-rescue`를 생성했다. `wrangler.jsonc`에는 실제 D1 ID를 설정했으며 두 마이그레이션을 원격에 적용했다. 계정 이메일 인증 후 Worker를 `https://maze-rescue-game.maze-rescue-game.workers.dev`에 배포했다. `PIN_PEPPER`와 `PUBLIC_ORIGIN`은 Worker secret으로 설정했다. **간편 로그인은 실제 HTTPS에서 검증했으며, Microsoft 로그인은 Entra 앱 등록과 연결을 기다린다.**

2026-10-08 화면 변경 `cc31474`을 Worker 버전 `40bb1bfd-fd96-44f9-94a1-8a7d8c29a2ad`에 반영했다. 배포 전 전체 테스트 211개와 lint·build가 통과했다. 실제 `/simple`에서 새 CSS·JS가 제공되고 `/api/health`는 200, 비로그인 `/api/me`·`/api/leaderboard`는 401임을 확인했다. Microsoft 시작 API는 비밀값이 없어 계속 503이다.

이어서 랭킹 UI `b3f7482`와 단계 그림 버튼 `d2fd939`를 Worker 버전 `a557d279-85e1-4f4b-a32f-aaad891ac7c2`에 반영했다. 전체 212개 테스트와 lint·build가 통과했고, 실제 `/simple`에서 새 CSS·JS를 제공한다. `/api/health` 200, 비로그인 `/api/me`·`/api/leaderboard` 401, Microsoft 시작 API 503 상태를 다시 확인했다. 로그인 후 랭킹·단계 화면은 로컬 API 모의 응답으로 1440×900·1213×600·320px에서 시각 검증했으며 운영 계정으로는 아직 검증하지 않았다.

2026-10-08 랭킹 20칸·중앙 타이틀 변경 `372339d`를 Worker 버전 `2dd718b3-522d-47c1-9f3e-4a03936c0767`로 배포했다. 전체 212개 테스트와 lint·build가 통과했다. 실제 `/simple`의 새 CSS·JS, `/api/health` 200, 비로그인 보호 API 401을 확인했다. Microsoft 시작 API는 계속 503이다. 로그인 후 랭킹의 20칸·목록 스크롤과 중앙 타이틀은 로컬 API 모의 응답으로 1440×900·1213×600·320px에서 확인했으며 운영 계정 검증은 남아 있다.

2026-10-08 기록 없는 계정의 0단계 순위와 랭킹 10명 페이지 변경 `08ab51f`을 Worker 버전 `3cb0e946-baa6-4689-92bc-e90ca4cbef2e`로 배포했다. 전체 213개 테스트와 lint·build가 통과했다. 실제 `/simple`, `/microsoft`, `/api/health`는 200, 비로그인 `/api/leaderboard`는 401이다. `/simple`은 새 JS 자산 `index-Dm7XYtld.js`를 제공한다. Microsoft 시작 API는 계속 503이다. 운영 계정으로 로그인한 뒤 0단계 순위·10명 페이지를 확인하는 절차는 남아 있다.

2026-10-08 `내 기록` 카드·`전체 순위` 구분과 `최고` 문구 제거 `b3dc1e3`을 Worker 버전 `4ff7c494-76ae-456b-b7b8-d9691009f638`로 배포했다. 전체 213개 테스트와 lint·build가 통과했다. 실제 `/simple`, `/microsoft`, `/api/health`는 200, 비로그인 `/api/leaderboard`는 401이며 새 JS·CSS 자산을 제공한다. 운영 D1의 `Smoke136503`, `Smoke712598`은 2026-10-06 오후 2:11·2:13 KST에 생성된 기록 없는 간편 계정으로, 당시 가입 smoke 점검과 시각이 일치한다. 이번 확인에서는 데이터를 수정하거나 삭제하지 않았다.

2026-10-08 책 형태의 캠페인·문/화살표 아이콘 버튼·중복 `내 기록` 배지 제거 `72ed083`를 Worker 버전 `2affe87f-0fd7-4a18-b264-3d05f80573f2`로 배포했다. 전체 213개 테스트와 lint·build가 통과했다. 로컬 Chrome 1440×900에서는 문서와 10개 랭킹 행에 스크롤이 없고, 390px에서는 책등 없이 기존 탭이 표시됐다. 실제 `/simple`, `/microsoft`, `/api/health`는 200, 비로그인 `/api/leaderboard`는 401이며 새 JS·CSS 자산을 제공한다. 운영 계정으로 로그인한 시각 확인은 남아 있다.

2026-10-08 삽화 책 배경과 양쪽 페이지 높이 맞춤 `28705b1`을 Worker 버전 `b798866a-fc19-4a16-8d5c-796e1b5e0252`로 배포했다. 전체 213개 테스트와 lint·build가 통과했다. 로컬 Chrome 1440×900과 1213×600에서 좌우 페이지의 위아래 좌표가 같고, 1440×900에서는 문서·랭킹 스크롤이 없었다. 390px 모바일은 기존 탭을 유지하며 가로 넘침이 없었다. 실제 `/simple`, `/microsoft`, `/api/health`는 200, 비로그인 `/api/leaderboard`는 401, `/assets/campaign/open-storybook.png`는 200 `image/png`(2,321,623바이트)였다. Microsoft Entra 앱 연결과 운영 계정 로그인 시각 확인은 남아 있다.

2026-10-08 책 삽화가 콘텐츠에 가려지는 문제를 고친 `02a0c6c`을 Worker 버전 `7d22f89d-293f-46a8-aad0-98881d2c16d7`로 배포했다. 데스크톱 콘텐츠를 책 가장자리와 접힘선에서 들이고, 카드 배경과 랭킹 행·단계 그림 버튼을 작게 조정했다. 로컬 Chrome 1440×900은 문서·랭킹 스크롤 없이 좌우 페이지가 높이 595px로 같았고, 1213×600에서도 둘 다 570px였다. 390px 모바일 랭킹 탭은 가로 넘침이 없었다. 전체 213개 테스트, lint, build가 통과했다. 실제 `/simple`, `/microsoft`, `/api/health`, 새 CSS와 책 PNG는 200, 비로그인 `/api/leaderboard`는 401이었다. 운영 계정의 로그인 후 시각 확인과 Microsoft Entra 연결은 남아 있다.

2026-10-08 데스크톱 랭킹의 단계·기록 열 사이 여백 변경 `a80d987`을 Worker 버전 `3f48916e-0f50-405c-9533-ca7e5b40e966`으로 배포했다. 랭킹 테스트 8개와 lint·build가 통과했다. 실제 `/simple`, `/microsoft`, `/api/health`, 새 CSS는 200, 비로그인 `/api/leaderboard`는 401이며 `/simple` HTML은 새 CSS를 참조한다. 모바일 행 배치는 유지했다.

2026-10-08 단계 사이의 직선 점선을 S자 곡선 점선으로 바꾼 `4c8f2be`을 Worker 버전 `6a307f3c-78a5-4983-a491-ee0f4edd8a45`로 배포했다. 데스크톱·390px 모바일의 가로·세로 연결을 로컬 Chrome에서 확인했고, 가로 넘침은 없었다. 단계 선택 테스트 4개와 lint·build가 통과했다. 실제 `/simple`, `/microsoft`, `/api/health`, 새 CSS 및 가로·세로 SVG는 200, 비로그인 `/api/leaderboard`는 401이었다. `/simple` HTML은 새 CSS를 참조한다.

2026-10-15 운영 D1에서 AI 가입 점검용으로 생성한 간편 계정 `Smoke136503`, `Smoke712598` 두 개를 정확한 ID·이름·생성 시각으로 제한해 삭제했다. 삭제 전 두 계정의 세션·게임 시도·완료 기록은 각각 0건이었다. 삭제 후 두 계정과 연관 데이터가 0건이고, 다른 운영 계정 2개는 유지됨을 확인했다. 로컬 DB의 기존 계정은 AI 생성 근거가 없어 수정하지 않았다.

| 항목 | 결과 |
| --- | --- |
| 로컬 D1 | `users`, `sessions`, `attempts`, `stage_records`, `oauth_flows`, `auth_throttle` 테이블 확인 |
| 로컬 `/api/health` | HTTP 200 |
| 로컬 `/microsoft`, `/simple` | 모두 HTTP 200 HTML |
| 비로그인 `/api/me`, `/api/leaderboard` | 모두 HTTP 401 |
| 원격 D1 | `maze-rescue` (`14d9c244-5db2-45c5-b9e9-2d9278e8a419`), `0001_initial.sql`과 `0002_sessions_expiry_index.sql` 적용 완료; 잔여 마이그레이션 없음 |
| Worker 배포 | `https://maze-rescue-game.maze-rescue-game.workers.dev`, 일일 세션 정리 cron 활성화 |
| 운영 Worker secrets | `PIN_PEPPER`, `PUBLIC_ORIGIN` 설정 완료; Microsoft 값 2개 대기 |
| 실제 로그인 | 간편 계정 가입·세션·로그아웃·재로그인 확인; Microsoft 앱 등록 대기 |

## 1. 계정과 로컬 준비

1. [Cloudflare 계정](https://dash.cloudflare.com/sign-up)을 만들고 Workers Free를 사용한다. `workers.dev` 서브도메인을 활성화한다. 유료 도메인이나 유료 플랜은 필요하지 않다.
2. [Microsoft Entra 앱 등록](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)을 할 수 있는 계정과 테넌트 권한을 준비한다. 개인 및 회사·학교 계정을 모두 받을 수 있는 등록 권한이 필요하다. 조직 계정의 사용자 동의가 막혀 있으면 해당 조직 관리자의 동의가 필요할 수 있다.
3. 프로젝트에서 `npm.cmd install`, `npm.cmd exec -- wrangler login`, `npm.cmd exec -- wrangler whoami`를 실행한다. 브라우저 인증은 계정 소유자가 직접 완료한다. 다른 Cloudflare 계정이 선택되었다면 진행하지 않는다.
4. 로컬 개발이 필요하면 `.dev.vars.example`을 `.dev.vars`로 복사한다. `PIN_PEPPER`에는 암호학적으로 안전한 난수 32바이트 이상의 값을 생성해 넣는다. 실제 값은 Git, 채팅, 명령 기록, 이 문서에 남기지 않는다. 로컬 Microsoft 로그인을 시험할 경우에만 나머지 값을 채운다.

`.dev.vars`와 `.wrangler/`는 `.gitignore`에서 제외한다. `PUBLIC_ORIGIN`은 로컬에서 `http://localhost:8787`, 운영에서는 끝 슬래시가 없는 실제 `https://<worker>.<account>.workers.dev` 주소다.

## 2. D1 생성과 스키마 적용

```powershell
npm.cmd exec -- wrangler d1 create maze-rescue
```

출력된 `database_id`를 `wrangler.jsonc`의 **자리표시자에만** 반영한다. `name`은 `maze-rescue-game`, D1 binding은 `DB`, 데이터베이스 이름은 `maze-rescue`를 유지한다. 이미 같은 이름의 DB가 있다면 새로 만들기 전에 소유 계정과 ID를 확인한다.

```powershell
npm.cmd exec -- wrangler d1 info maze-rescue
npm.cmd exec -- wrangler d1 migrations apply maze-rescue --local
npm.cmd exec -- wrangler d1 migrations list maze-rescue --remote
npm.cmd exec -- wrangler d1 migrations apply maze-rescue --remote
```

`--remote` 전에 `whoami`, D1 이름과 ID, 적용 대상 계정을 다시 확인한다. 마이그레이션은 `migrations/0001_initial.sql`, `0002_sessions_expiry_index.sql` 순서다. [Cloudflare D1 명령 문서](https://developers.cloudflare.com/d1/wrangler-commands/)에 따르면 적용 시 백업을 만들고, 실패한 마이그레이션은 롤백된다.

## 3. 첫 Worker 배포와 Microsoft 앱 등록

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
npm.cmd exec -- wrangler deploy
```

출력된 `https://<worker>.<account>.workers.dev` 주소를 기록한다. 첫 배포는 인증 비밀값을 넣기 전일 수 있으므로 이때 사용자에게 링크를 배포하지 않는다. Worker의 `/microsoft`와 `/simple`은 같은 서비스의 두 주소다.

Microsoft Entra의 **App registrations → New registration**에서 지원 계정 유형을 **Accounts in any organizational directory and personal Microsoft accounts**로 선택한다. 플랫폼은 **Web**, redirect URI는 정확히 다음과 같다.

```text
https://maze-rescue-game.maze-rescue-game.workers.dev/api/auth/microsoft/callback
```

앱의 Application (client) ID와 client secret **값**은 비밀 저장소에만 보관한다. client secret 만료 날짜를 운영자가 기록하고, 만료 전에 Entra에서 새 secret을 발급해 Cloudflare 값을 갱신한 뒤 Microsoft 로그인을 확인한다. 앱이 요청하는 OIDC scope는 `openid profile`이다. 조직별 관리자 동의가 필요하면 권한을 임의로 늘리지 말고 실제 오류와 테스트 제약을 기록한다. [Microsoft 등록 문서](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app), [redirect URI 규칙](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)을 따른다.

## 4. Worker 비밀값 연결

아래 명령은 각각 대화형으로 값을 입력한다. 값이 콘솔 명령줄·파일·로그에 남지 않게 한다. Cloudflare의 `secret put`은 Worker 새 버전을 즉시 배포하므로 값을 모두 넣은 뒤 최종 배포와 점검을 다시 한다. [Workers secrets 문서](https://developers.cloudflare.com/workers/configuration/secrets/).

```powershell
npm.cmd exec -- wrangler secret put PIN_PEPPER
npm.cmd exec -- wrangler secret put MICROSOFT_CLIENT_ID
npm.cmd exec -- wrangler secret put MICROSOFT_CLIENT_SECRET
npm.cmd exec -- wrangler secret put PUBLIC_ORIGIN
npm.cmd exec -- wrangler deploy
```

`PIN_PEPPER`는 32바이트 이상의 CSPRNG 값이다. `PUBLIC_ORIGIN`은 3단계에서 확인한 정확한 HTTPS origin이다. Microsoft callback URI도 그 origin의 `/api/auth/microsoft/callback`과 일치해야 한다. 비밀값 갱신·재배포 후에는 로그인 회귀 확인을 다시 한다.

## 5. 실제 주소 점검

아래 표에 관찰한 실제 URL과 결과를 적는다. 운영 D1에 가짜 랭킹 행을 직접 삽입하지 않는다.

| 점검 | 기대 결과 | 실제 결과 |
| --- | --- | --- |
| `PUBLIC_ORIGIN/api/health` | 200 JSON | 200 JSON |
| `PUBLIC_ORIGIN/microsoft`, `/simple` 직접 진입 | 200 HTML | 모두 200 HTML |
| 비로그인 `/api/me`, `/api/leaderboard` | 401 JSON | 모두 401 |
| 간편 가입·로그아웃·재로그인·잘못된 PIN 거부 | 정상 동작 | 가입 200, `/api/me` 200, 로그아웃 204, 이후 `/api/me` 401, 재로그인 200; 잘못된 PIN 401, 이후 올바른 PIN 200 |
| Microsoft 개인 계정 로그인·로그아웃 | 정상 동작 | Entra 연결 전 `/api/auth/microsoft/start` 503; 실계정 미검증 |
| 회사·학교 계정 로그인 | 동의 정책에 따라 허용 또는 오류 기록 | 미검증 |
| 1단계 완료·2단계 해금·최고 시간·랭킹 | 서버 반영 | 미검증 |
| 다른 브라우저에서 같은 계정 로그인 | 해금·최고 시간 복원, 진행 중 미로는 복원하지 않음 | 미검증 |
| Microsoft·간편 랭킹 | 서로 다른 계정 목록 | 미검증 |

완료 시 실제 origin, 두 경로 URL, D1 ID, 실행 날짜, Microsoft secret 만료 날짜, 사용한 테스트 계정 **종류만** 기록한다. PIN과 secret 값은 기록하지 않는다. 인증 오류는 Worker 로그와 Entra redirect 설정을 비교하고, D1 오류는 binding ID와 마이그레이션 상태를 확인한다. API가 401이면 세션 쿠키와 origin을 확인한다.

## 무료 한도와 운영

- [Workers Free](https://developers.cloudflare.com/workers/platform/limits/): Worker 스크립트 요청 100,000회/일. 초과 시 API 호출에 429가 반환될 수 있다. 무료 플랜 CPU 제한도 있으므로 실제 간편 PIN 로그인을 배포 주소에서 점검한다.
- [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/): 5,000,000행 읽기/일, 100,000행 쓰기/일, 저장 5 GB. 일일 읽기·쓰기 한도에 도달하면 D1 쿼리가 실패한다.
- [정적 자산](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): 정적 파일 요청은 무료이며 무제한이다. 이 앱은 `/api/*`에만 `run_worker_first`를 적용해 API 요청이 Worker 제한에 포함된다.
- Worker의 일일 cron이 만료 세션을 정리한다. 로컬 `wrangler dev`에서는 자동 실행되지 않으므로 필요하면 로컬 scheduled endpoint로 따로 시험한다.

배포·마이그레이션 전에 `git status --short`를 확인하고 `.dev.vars`, `.wrangler/`, secret 값이 추적되지 않았는지 확인한다. 새 마이그레이션이 있으면 로컬 적용 후 원격 적용하며, 원격 적용 전에는 대상 계정과 DB를 다시 확인한다.
