# Task: T01 Cloudflare·Microsoft 실제 배포

## Status: pending

## Goal

Cloudflare 무료 계정·D1·Workers와 Microsoft Entra 앱 등록을 연결하고, 실제 `workers.dev`의 두 경로에서 로그인, 기록 동기화, 유형별 랭킹을 확인한다. 실제 주소와 운영 명령을 문서화한다.

## Decision Summary

- 사용자는 Cloudflare 계정과 Microsoft Entra 앱 등록을 아직 준비하지 않았다. 유료 도메인·유료 플랜을 전제로 하지 않는다.
- 배포는 한 Worker의 `/microsoft`, `/simple` 경로다. 비밀값은 Cloudflare secrets/로컬 `.dev.vars`에만 넣고 Git에 남기지 않는다.

## Implementation

### I01. 계정·앱 등록 및 환경 연결

- Related Files:
  - `wrangler.jsonc` :: `d1_databases[0].database_id`, `name`, `compatibility_date` — 실제 무료 D1 ID와 Worker 이름 확정; modify
  - `.dev.vars.example` :: environment key template — 값 없이 필요한 변수 이름과 로컬 예시 origin; new
  - `docs/deployment.md` :: setup/runbook — 계정 등록, secret, migration, 확인, 장애 대응; new
  - `.gitignore` :: `.dev.vars`, `.wrangler/` — secret과 로컬 상태 제외 여부 재확인; read-only

#### Details

- **Signatures & Types**: 운영 secret 이름은 `PIN_PEPPER`(CSPRNG 32 byte 이상), `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `PUBLIC_ORIGIN`이다. `PUBLIC_ORIGIN`은 trailing slash 없는 실제 `https://<worker>.<account>.workers.dev`와 일치해야 한다. Microsoft Web redirect URI는 정확히 `${PUBLIC_ORIGIN}/api/auth/microsoft/callback`이다.
- **Data & Schema Fields**: Cloudflare는 Workers Free 및 D1 Free, Microsoft 앱은 `Accounts in any organizational directory and personal Microsoft accounts`, 플랫폼은 `Web`, 요청 OIDC scope는 `openid profile`이다. D1 binding 이름은 `DB`를 유지한다.
- **Execution Flow / Logic**:
  1. 사용자가 Cloudflare 및 Microsoft 계정을 만들고 필요한 약관 수락·다중 인증 등 계정 소유자 조치를 완료한다. 실행자는 로그인된 계정/CLI 권한이 준비되면 계속한다. 계정 비밀번호·PIN pepper·client secret 값을 문서나 채팅에 복사하지 않는다.
  2. `npm.cmd exec -- wrangler login`, `npm.cmd exec -- wrangler d1 create maze-rescue`를 수행하고 생성된 database ID를 `wrangler.jsonc`의 placeholder와 교체한다. `npm.cmd exec -- wrangler d1 migrations apply maze-rescue --local` 및 `--remote`로 schema를 적용한다. 원격 명령 전에 계정·DB 이름·ID를 다시 확인한다.
  3. `PIN_PEPPER`를 `wrangler secret put`으로 넣고 최초 Worker를 배포해 `workers.dev` origin을 확인한다. Cloudflare 무료 기본 주소의 서브도메인을 기록한다.
  4. Microsoft Entra에서 위 audience로 앱을 등록하고 실제 callback URI를 `Web` redirect로 넣는다. client ID와 발급된 client secret을 Cloudflare secret에 설정한다. `PUBLIC_ORIGIN`도 Worker 환경에 설정한 뒤 재배포한다. secret 만료 날짜와 갱신 방법을 runbook에 적되 secret 값은 기록하지 않는다.
  5. 계정/테넌트 정책상 조직 로그인에 관리자 동의가 요구되면 정확한 오류와 테스트 범위를 기록한다. 앱 권한을 임의로 늘리거나 유료 플랜으로 전환하지 않는다.

### I02. 실제 배포 확인과 문서 정리

- Related Files:
  - `README.md` :: 실행·배포·로그인 설명 — 더 이상 사실이 아닌 `Microsoft 계정 로그인 미지원` 문장 교체, 실제 두 주소 링크; modify
  - `docs/deployment.md` :: deployment status/smoke results — 날짜·origin·실행 명령·검증 결과·무료 한도; modify
  - `worker/auth/microsoft.test.ts`, `worker/game/leaderboard.test.ts`, `src/App.test.tsx` :: 회귀 테스트 — 발견된 결함만 수정할 경우 관련 테스트 보강; modify-if-needed

#### Details

- **Execution Flow / Logic**:
  1. 로컬에서 전체 테스트·lint·build 및 `wrangler dev`의 `/api/health`, `/microsoft`, `/simple` 직접 진입을 확인한다. `wrangler deploy` 후 실제 URL에서도 동일 항목을 확인한다.
  2. 로그아웃 상태 두 경로에서 게임·랭킹이 열리지 않고 보호 API가 401인지 확인한다. 간편 계정 가입·재로그인·로그아웃, 올바르지 않은 PIN 제한을 확인한다. Microsoft 개인 계정 실제 로그인과 조직 계정 로그인은 접근 가능한 테스트 계정이 있으면 각각 확인한다.
  3. 계정 A에서 1단계를 완료해 최고 시간과 랭킹 반영을 확인하고, 다른 브라우저/기기에서 해금·최고 시간이 복원되는지 확인한다. 진행 중 미로는 다른 기기에 나타나지 않아야 한다. 간편/Microsoft 랭킹의 상호 비노출을 확인한다. 운영 DB에 테스트용 가짜 랭킹을 직접 삽입하지 않는다.
  4. `docs/deployment.md`에 관측한 Worker URL, 두 경로, D1 이름, Microsoft callback URI, secret **이름만**, 재배포·migration 절차, 무료 한도와 초과 시 동작을 적는다. Workers 100,000 API requests/day, D1 5,000,000 rows read/day·100,000 rows written/day·5 GB 저장량을 공식 문서 링크와 함께 기록한다. 정적 자산 무료 정책도 공식 문서 링크로 명시한다.
  5. `git status --short`에서 secret, `.dev.vars`, `.wrangler`가 추적되지 않는지 확인한다. 배포 과정에서 수정한 제품 코드가 있으면 관련 테스트를 다시 실행하고 이 Task에만 포함한다.

## Acceptance Criteria

- [ ] 하나의 실제 무료 배포 주소의 `/microsoft`, `/simple`가 HTTPS로 열린다.
- [ ] Microsoft 앱 redirect, D1 binding, Worker secrets가 설정되고 PIN/secret 값은 Git·로그·문서에 없다.
- [ ] 비로그인 플레이 금지, 간편 로그인, Microsoft 실제 로그인, 계정 기록·랭킹 유형 분리가 배포 주소에서 확인된다. 사용할 수 없는 조직 테스트 계정/관리자 동의 제약은 명시된다.
- [ ] README와 운영 문서가 실제 주소·명령·무료 한도·남은 검증 제약을 정확히 설명한다.

## Validation

- `npm.cmd test -- --run` — 전체 클라이언트·Worker 회귀 통과
- `npm.cmd run lint` — 타입 검사 통과
- `npm.cmd run build` — 배포 자산 빌드 통과
- `npm.cmd exec -- wrangler d1 migrations apply maze-rescue --remote` — 실제 D1 migration 적용 확인
- `npm.cmd exec -- wrangler deploy` — 실제 Worker 배포 성공 및 URL 출력
- `git diff --check` — 공백 오류 없음
- 실제 URL 브라우저 smoke: 두 경로·간편 가입/로그인·Microsoft 로그인·로그아웃·단계 완료·랭킹·다른 기기 동기화 — 관찰 결과를 `docs/deployment.md`에 기록

## Commit Message

```text
chore(deploy): publish dual-login maze game

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P03-release
Task: T01-cloudflare-entra-deploy

- Bind production D1 and Microsoft redirect settings
- Document live URLs, smoke results, and free-tier operations
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## 실행 기록 (2026-10-06)

- 로컬 D1 마이그레이션 상태와 필요한 테이블을 확인했다.
- 로컬 Worker의 `/api/health`, `/microsoft`, `/simple`은 200, 비로그인 `/api/me`, `/api/leaderboard`는 401이었다.
- 전체 208개 테스트, lint, build가 통과했다.
- `README.md`, `.dev.vars.example`, `docs/deployment.md`를 준비했다. 실제 비밀값은 Git에 스테이징하지 않았다.
- Cloudflare Wrangler 계정 인증 후 원격 D1 `maze-rescue` (`14d9c244-5db2-45c5-b9e9-2d9278e8a419`)를 생성했다. 두 마이그레이션을 적용했고 미적용 항목이 없다.
- Cloudflare 이메일 인증을 마친 뒤 Worker를 `https://maze-rescue-game.maze-rescue-game.workers.dev`에 배포했다. `PIN_PEPPER`와 `PUBLIC_ORIGIN` secret 및 일일 세션 정리 cron을 확인했다.
- 운영 HTTPS에서 `/api/health`와 두 화면이 200, 비로그인 보호 API가 401이었다. 간편 계정의 가입·세션 확인·로그아웃·재로그인이 정상 동작했다.
- Microsoft Entra 앱 등록과 실제 Microsoft 계정 로그인 검증을 기다린다. Task 완료·커밋·포인터 전진은 보류한다.

## 실행 기록 (2026-10-08)

- 화면 변경 `cc31474`을 Worker 버전 `40bb1bfd-fd96-44f9-94a1-8a7d8c29a2ad`로 재배포했다. 전체 211개 테스트와 lint·build가 통과했다.
- 원격 D1 미적용 마이그레이션이 없고 운영 secret 이름은 `PIN_PEPPER`, `PUBLIC_ORIGIN`임을 재확인했다.
- 실제 `/simple`은 변경 CSS·JS를 제공하며 `/api/health` 200, 비로그인 `/api/me`·`/api/leaderboard` 401, Microsoft 시작 API 503을 확인했다.
- Microsoft Entra 앱 등록 권한이 있는 계정 접근을 기다린다. 실계정 로그인·단계 완료·랭킹·다른 기기 동기화는 아직 검증하지 않았다.
- 랭킹 UI `b3f7482`와 단계 그림 버튼 `d2fd939`를 전체 212개 테스트 통과 후 Worker 버전 `a557d279-85e1-4f4b-a32f-aaad891ac7c2`로 배포했다. 새 자산과 운영 `/api/health` 200, 비로그인 보호 API 401을 확인했다. Microsoft 시작 API는 계속 503이다.
- 랭킹 20칸·중앙 타이틀 `372339d`를 전체 212개 테스트 통과 후 Worker 버전 `2dd718b3-522d-47c1-9f3e-4a03936c0767`로 배포했다. 새 자산과 운영 `/api/health` 200, 비로그인 보호 API 401을 확인했다. Microsoft 시작 API는 계속 503이다.
- 0단계 계정 순위·랭킹 10명 페이지 `08ab51f`을 전체 213개 테스트, lint, build 통과 후 Worker 버전 `3cb0e946-baa6-4689-92bc-e90ca4cbef2e`로 배포했다. 운영 `/simple`, `/microsoft`, `/api/health` 200, 비로그인 `/api/leaderboard` 401, Microsoft 시작 API 503을 확인했다. 운영 계정에서의 0단계 순위·페이지 동작은 아직 검증하지 않았다.
- 내 기록·전체 순위 구분과 `최고` 문구 제거 `b3dc1e3`을 전체 213개 테스트, lint, build 통과 후 Worker 버전 `4ff7c494-76ae-456b-b7b8-d9691009f638`로 배포했다. 운영 `/simple`, `/microsoft`, `/api/health` 200, 비로그인 `/api/leaderboard` 401 및 새 JS·CSS 자산을 확인했다. 운영 D1의 두 Smoke 간편 계정은 이전 가입 점검 시간과 생성 시각이 일치하며 이번에 읽기 전용으로만 확인했다.
- 책 형태의 캠페인·아이콘 버튼·중복 배지 제거 `72ed083`를 전체 213개 테스트, lint, build 통과 후 Worker 버전 `2affe87f-0fd7-4a18-b264-3d05f80573f2`로 배포했다. 로컬 Chrome 1440×900에서 문서·랭킹 10행 스크롤이 없고 390px 모바일에서 탭·단일 페이지가 유지됨을 확인했다. 운영 `/simple`, `/microsoft`, `/api/health` 200, 비로그인 `/api/leaderboard` 401 및 새 JS·CSS 자산을 확인했다.
- 삽화 책 배경과 좌우 페이지 높이 맞춤 `28705b1`을 전체 213개 테스트, lint, build 통과 후 Worker 버전 `b798866a-fc19-4a16-8d5c-796e1b5e0252`로 배포했다. 로컬 Chrome 1440×900과 1213×600에서 좌우 높이가 같고 390px 모바일에서 가로 넘침이 없었다. 운영 `/simple`, `/microsoft`, `/api/health`, 새 책 PNG 자산은 200, 비로그인 `/api/leaderboard`는 401이었다. Microsoft Entra 앱 등록 및 실계정 로그인 검증은 계속 남아 있다.
- 책 삽화 가림을 줄인 콘텐츠 배치 `02a0c6c`을 전체 213개 테스트, lint, build 통과 후 Worker 버전 `7d22f89d-293f-46a8-aad0-98881d2c16d7`로 배포했다. 로컬 Chrome 1440×900은 문서·랭킹 스크롤 없이 좌우 페이지 높이 595px, 1213×600은 모두 570px였다. 390px 모바일 랭킹 탭은 가로 넘침이 없었다. 운영 두 화면·health·새 CSS·책 PNG는 200, 비로그인 `/api/leaderboard`는 401이었다. Microsoft Entra 앱 등록 및 실계정 로그인 검증은 계속 남아 있다.
- 데스크톱 랭킹 단계·기록 열 여백 `a80d987`을 랭킹 테스트 8개, lint, build 통과 후 Worker 버전 `3f48916e-0f50-405c-9533-ca7e5b40e966`으로 배포했다. 운영 두 화면·health·새 CSS는 200, 비로그인 `/api/leaderboard`는 401이며 HTML의 새 CSS 참조를 확인했다. Microsoft Entra 앱 등록 및 실계정 로그인 검증은 계속 남아 있다.
- 구불구불한 단계 점선 `4c8f2be`을 단계 선택 테스트 4개, lint, build 통과 후 Worker 버전 `6a307f3c-78a5-4983-a491-ee0f4edd8a45`로 배포했다. 로컬 Chrome 데스크톱·390px 모바일에서 가로·세로 곡선과 가로 넘침 없음 확인. 운영 두 화면·health·새 CSS·가로/세로 SVG는 200, 비로그인 `/api/leaderboard`는 401이었다. Microsoft Entra 앱 등록 및 실계정 로그인 검증은 계속 남아 있다.

## 데이터 정리 기록 (2026-10-15)

- 사용자의 요청에 따라 운영 D1의 AI 가입 점검용 `Smoke136503`, `Smoke712598` 두 간편 계정을 정확한 ID·이름·생성 시각 조건으로 삭제했다.
- 삭제 전 각 계정에 연결된 세션·게임 시도·완료 기록은 0건이었다. 삭제 후 두 계정 및 연관 데이터 0건, 남은 운영 계정 2건을 확인했다.
- 로컬 DB의 기존 계정과 운영 DB의 다른 두 계정은 AI 생성 근거가 없어 유지했다.

## 제목 변경 배포 기록 (2026-10-15)

- 게임 제목 변경 `8edff19`을 Worker 버전 `59086184-e193-44fe-9dfa-b66dd84e5941`로 배포했다. 대상은 기존 `maze-rescue-game` Worker와 D1 binding `maze-rescue`이다.
- 제목 관련 테스트 20개, lint, build가 통과했다. 운영 `/`, `/simple`, `/microsoft`는 모두 200이며 UTF-8 HTML 제목이 정확히 `동물구조탐험대`인지 확인했다.
- Microsoft Entra 앱 등록과 실제 로그인 검증은 아직 남아 있다.
