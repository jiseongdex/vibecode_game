# Task: T01 로그인 클라이언트와 화면

## Status: done

## Goal

Worker API에 연결되는 브라우저 클라이언트와 두 경로 전용 로그인 화면을 만든다. 기존 `App.tsx`의 게임 흐름은 다음 Task에서 서버 진행도와 함께 한 번에 연결하여 기존 게임 테스트를 중간 단계에서 깨지 않게 한다.

## Decision Summary

- `/microsoft`는 Microsoft 로그인, `/simple`은 닉네임·4자리 PIN 가입/로그인만 제공한다. 비로그인 플레이와 랭킹은 다음 Task의 App 관문에서 차단한다.
- 클라이언트는 same-origin Cookie 세션을 사용한다. 브라우저 저장소에 PIN·Microsoft token·세션 token을 넣지 않는다.

## Implementation

### I01. 타입 있는 API 호출과 로그인 상태

- Related Files:
  - `src/api/client.ts` :: `ApiClientError`, `requestJson`, `getSession`, `registerSimple`, `loginSimple`, `logout`, `startRun`, `finishRun`, `getLeaderboard` — Worker API 호출; new
  - `src/api/client.test.ts` :: request/error tests — credentials, 401, 오류 코드, 네트워크 오류; new
  - `src/hooks/useAuthSession.ts` :: `useAuthSession` — `/api/me` bootstrap 및 재조회; new
  - `src/hooks/useAuthSession.test.ts` :: hook tests — loading/anonymous/authenticated/error 상태; new

#### Details

- **Signatures & Types**:
  ```typescript
  class ApiClientError extends Error { status: number; code: string }
  function getSession(): Promise<SessionDto>
  function registerSimple(nickname: string, pin: string): Promise<SessionDto>
  function loginSimple(nickname: string, pin: string): Promise<SessionDto>
  function logout(): Promise<void>
  function startRun(stage: number): Promise<StartRunDto>
  function finishRun(attemptId: string, clearTimeSeconds: number): Promise<FinishRunDto>
  function getLeaderboard(): Promise<LeaderboardDto>
  function useAuthSession(): { status: 'loading' | 'anonymous' | 'authenticated' | 'error'; session: SessionDto | null; error: string | null; refresh: () => Promise<void>; accept: (session: SessionDto) => void; signOut: () => Promise<void> }
  ```
- **Data & Schema Fields**: `SessionDto.user.authType`와 `ProgressDto`는 P01 공유 계약 그대로 쓴다. POST body는 `src/api/contracts.ts`의 `StartRunRequest`, `FinishRunRequest`, 간편 가입·로그인 `{nickname,pin}`과 일치한다. API 오류 JSON `{error:{code,message}}`를 `ApiClientError`로 바꾼다.
- **Execution Flow / Logic**:
  1. `fetch`는 상대 경로 `/api/...`, `credentials:'same-origin'`, POST의 `Content-Type: application/json`, `cache:'no-store'`를 사용한다. 오류 body를 파싱할 수 없으면 안전한 일반 메시지를 쓴다.
  2. `getSession`의 401은 로그인 필요를 뜻하고, 네트워크/5xx는 오류 상태와 재시도 버튼을 위한 상태로 분리한다. 서버 오류에서 게임을 비회원 모드로 열지 않는다.
  3. 로그인 성공 시 `accept`가 세션 DTO를 저장하고, 로그아웃은 API 완료 후 메모리의 세션을 지운다. 로그아웃 실패 때도 게임을 열린 상태로 두지 않고 재조회하거나 오류 상태로 전환한다.

### I02. 경로 판별과 두 로그인 UI

- Related Files:
  - `src/components/Auth/LoginScreen.tsx` :: `getAuthRoute`, `LoginScreen`, `RouteChoice` — 로그인/가입 UI와 루트 경로 선택; new
  - `src/components/Auth/LoginScreen.module.css` :: auth styles — 기존 게임의 반응형 스타일과 조화; new
  - `src/components/Auth/LoginScreen.test.tsx` :: UI tests — 경로별 버튼·입력·오류; new

#### Details

- **Signatures & Types**:
  ```typescript
  type AuthRoute = 'microsoft' | 'simple' | null
  function getAuthRoute(pathname: string): AuthRoute
  function LoginScreen(props: { authType: 'microsoft' | 'simple'; onAuthenticated: (session: SessionDto) => void }): ReactElement
  function RouteChoice(): ReactElement
  ```
- **Execution Flow / Logic**:
  1. `/microsoft`와 `/microsoft/`는 Microsoft, `/simple`와 `/simple/`는 간편 계정으로 분류한다. `/`는 두 주소 선택 화면, 그 외 경로는 게임을 표시하지 않고 두 경로로 이동할 수 있게 한다.
  2. 간편 화면은 가입·로그인 탭, 닉네임과 `type="password"`, `inputMode="numeric"`, 4자리 PIN 입력을 제공한다. 가입 409와 로그인 401, 제한 429를 알아볼 수 있는 한국어 문장으로 보여준다. PIN 분실 시 새 닉네임으로 가입해야 하며 기존 기록은 복구되지 않는다고 안내한다.
  3. Microsoft 화면은 `/api/auth/microsoft/start`로 이동하는 버튼과 표시 이름이 같은 유형 사용자에게 공개될 수 있다는 짧은 안내를 제공한다. OAuth 실패 query는 비밀값 없이 오류 문장으로 바꾼다.
  4. 비동기 제출 중 버튼을 잠그고 중복 요청을 막는다. 화면은 키보드·모바일에서 사용 가능해야 한다. 이 Task에서는 `App.tsx`에 아직 연결하지 않는다.

## Acceptance Criteria

- [x] API 클라이언트가 세션 Cookie 요청, 성공 DTO, 401/429/5xx를 구분한다.
- [x] 두 로그인 화면에 다른 방식의 입력/버튼이 섞이지 않는다.
- [x] PIN·OAuth token·세션 token을 localStorage에 저장하지 않는다.
- [x] 기존 App 게임 테스트는 이 Task에서 그대로 통과한다.

## Validation

- `npm.cmd test -- --run src/api/client.test.ts src/hooks/useAuthSession.test.ts src/components/Auth/LoginScreen.test.tsx` — 클라이언트·화면 단위 검증 통과
- `npm.cmd test -- --run src/App.test.tsx` — 기존 게임 UI 회귀 없음
- `npm.cmd run lint` — 타입 검사 통과
- `npm.cmd run build` — 프로덕션 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(client): 두 로그인 클라이언트와 화면 준비

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P02-game-client
Task: T01-auth-gate-and-api-client

- 같은 출처 API 클라이언트와 세션 상태 추가
- Microsoft와 간편 로그인 화면 분리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `856e0ca`
