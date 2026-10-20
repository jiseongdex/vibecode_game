# Task: T01 Azure Microsoft 전용 클라이언트와 정적 빌드

## Status: done

## Goal

같은 React 게임에서 Azure 배포에만 Microsoft 로그인 화면을 보여주고, Cloudflare 배포의 간편 로그인 화면·주소·빌드 동작을 보존한다.

## Decision Summary

- Azure 기본 HTTPS 주소의 `/`와 `/microsoft`는 Microsoft 로그인으로 들어간다. Azure `/simple`에는 간편 가입/PIN 화면이나 게임을 보여주지 않는다.
- 기존 클라이언트의 `/api/me`, `/api/runs/*`, `/api/leaderboard`와 `SessionDto` 계약은 Azure API에서도 그대로 쓴다. 별도 데이터 이전은 없다.

## Commit Scope Guard

`.memory/`는 로컬 전용으로 상태만 갱신하고 스테이징하지 않는다. 커밋 직전 index를 확인해 Cloudflare 관련 파일이나 다른 작업의 변경을 포함하지 않는다. 이 Task의 구현 파일만 명시적 pathspec으로 커밋한다.

## Implementation

### I01. 배포 대상별 라우트·화면

- Related Files:
  - `src/App.tsx` :: `App`, `AuthGate` — modify
  - `src/components/Auth/LoginScreen.tsx` :: `LoginScreen`, `RouteChoice`, `getAuthRoute` — modify
  - `src/api/client.ts` :: endpoints — read-only unless Azure host parity requires narrowly scoped change
  - `src/hooks/useAuthSession.ts` :: `useAuthSession` — read-only
  - `src/App.test.tsx`, `src/components/Auth/LoginScreen.test.tsx` :: Azure/Cloudflare route tests — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type DeploymentTarget = 'cloudflare' | 'azure'
  function getDeploymentTarget(): DeploymentTarget
  function getAuthRoute(pathname: string, target?: DeploymentTarget): AuthType | null
  ```
- `VITE_DEPLOY_TARGET=azure`일 때만 `azure`로 판단하고, 값 누락/기타 값은 `cloudflare`로 둔다. 모듈 상수여도 테스트에서는 주입 가능한 순수 route 함수를 제공한다. 브라우저에 Cosmos 키·Entra secret이 실리지 않도록 build 변수는 이 공개 대상 선택 값만 쓴다.
- Azure `/`와 `/microsoft`에서 `AuthGate authType='microsoft'`를 사용한다. Azure `/simple` 또는 그 외 잘못된 경로는 Microsoft 로그인으로 안전하게 안내하거나 `/microsoft`로 리다이렉트하되 간편 로그인 UI를 렌더하지 않는다. Azure 로그인 화면의 뒤로 가기 문구는 `Microsoft 로그인` 또는 홈으로 맞춘다. Azure에서 `RouteChoice`의 간편 링크를 노출하지 않는다.
- Cloudflare 기본 빌드는 현재 `/` 선택 화면, `/simple` 간편 가입/로그인, `/microsoft` 기존 경로를 유지한다. Azure API에서 simple endpoint가 404여도 화면에 호출 경로가 남지 않게 한다. 로그인 안 한 사람은 어느 Azure 경로에서도 게임·랭킹에 들어가지 못한다.
- Azure의 로그인 후 계정 ID는 Cosmos의 독립 UserDoc ID이므로 `usePersistedGame`의 브라우저 임시 저장은 Azure origin·계정 기준으로 분리된다. 과거 Cloudflare 로컬 진행을 Azure 계정에 병합하지 않는다. 서버 `SessionDto.progress`가 우선이다.

### I02. 별도 빌드와 SWA 경로 설정

- Related Files:
  - `package.json` :: `build:azure`, `deploy:azure` 또는 배포 전용 script — modify
  - `vite.config.ts` :: Azure build input — modify only if needed
  - `public/staticwebapp.config.json` :: SPA navigation fallback 및 Node 20 `apiRuntime` — new
  - `src/App.test.tsx`, `src/components/Auth/LoginScreen.test.tsx` — modify

#### Details

- `build:azure`는 PowerShell/CI에서도 동작하는 플랫폼 독립 환경 변수 주입 방식(예: Vite `--mode azure`와 `.env.azure`의 비밀 없는 `VITE_DEPLOY_TARGET=azure`)으로 `dist`를 만든다. 이 빌드는 기존 `npm run build`를 바꾸지 않는다. `.env.azure`를 새로 쓰면 `.gitignore` 규칙을 확인해 추적 가능하게 하거나 script로 공개 flag를 주입한다.
- `staticwebapp.config.json`은 배포 `dist`에 복사되도록 `public/` 아래 둔다. `/microsoft` 및 `/` 새로고침 시 SPA의 `index.html`로 이동시키되 `/api/*`와 실제 asset은 fallback 대상에서 제외한다. `platform.apiRuntime`은 관리형 Functions가 지원하는 Node 20으로 지정한다. `/api` 없는 라우트의 404 JSON을 SPA fallback이 삼키지 않도록 실제 Azure 호스트에서도 점검한다.
- 테스트는 대상별 `/`, `/microsoft`, `/simple` 및 비로그인 게이트를 모두 검증한다. Azure 번들에 간편 로그인 유도 링크/PIN 입력이 보이지 않고 Cloudflare 기본 번들 화면에는 두 선택지가 있는지 확인한다. Azure 빌드 후에도 Cloudflare 빌드·전체 테스트를 수행한다.

## Acceptance Criteria

- [x] Azure `/`·`/microsoft`는 Microsoft 로그인, `/simple`는 간편 가입·게임 불가다.
- [x] Cloudflare 기본 빌드의 두 경로와 간편 로그인은 그대로다.
- [x] Azure `dist`에 SWA 설정이 포함되고 `/api` 보호 응답이 SPA fallback에 가려지지 않는다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/Auth/LoginScreen.test.tsx` — 대상별 라우트/UI 통과
- `npm.cmd run lint` — 전체 TypeScript 통과
- `npm.cmd run build:azure` — Azure 번들·`dist/staticwebapp.config.json` 생성
- `npm.cmd run build` — 기존 Cloudflare 기본 빌드 통과
- `npm.cmd test -- --run` — 기존 UI/게임/Worker 회귀 통과

## Commit Message

```text
feat(azure): Microsoft 전용 게임 화면과 빌드 분리

Plan: 2026-10-15-azure-microsoft-game-free-isolated
Phase: P02-azure-client
Task: T01-azure-client-build

- Azure에서는 Microsoft 로그인만 표시하고 게임 접근 보호
- 기존 Cloudflare 화면과 별도 정적 빌드 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: d7bc8b9
