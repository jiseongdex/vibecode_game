# Task: T02 간편 계정 인증

## Status: done

## Goal

닉네임과 숫자 4자리 PIN으로 누구나 계정을 만들고 로그인할 수 있게 하되, 서버가 PIN 원문을 저장하지 않고 로그인 시도를 제한한다. 인증 성공 시 두 계정 유형이 공통으로 쓸 안전한 세션을 발급한다.

## Decision Summary

- 간편 계정의 닉네임은 유형 안에서 고유하다. PIN 분실 시 복구하지 않고 다른 닉네임으로 새로 가입한다.
- 비로그인 상태에서는 게임·랭킹 API에 접근할 수 없다. 이후 Microsoft 로그인도 이 Task의 세션 저장소를 재사용한다.

## Implementation

### I01. 입력·PIN 저장·시도 제한

- Related Files:
  - `worker/auth/simple.ts` :: `normalizeNickname`, `hashPin`, `verifyPin`, `registerSimple`, `loginSimple` — 가입·로그인 규칙; new
  - `worker/auth/throttle.ts` :: `checkThrottle`, `recordFailure`, `recordSignup`, `clearThrottle` — D1 기반 시도 제한; new
  - `worker/types.ts` :: `Env.PIN_PEPPER` — 필수 런타임 secret 검사; modify
  - `worker/test/createTestEnv.ts` :: `createTestEnv` — 테스트용 secret과 분리된 D1 제공; modify
  - `worker/auth/simple.test.ts` :: registration/login tests — 중복·PIN·시도 제한 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  function normalizeNickname(input: unknown): { displayName: string; nicknameKey: string }
  async function hashPin(pin: string, salt: Uint8Array, pepper: string): Promise<string>
  async function verifyPin(pin: string, saltBase64: string, storedHash: string, pepper: string): Promise<boolean>
  async function registerSimple(request: Request, env: Env): Promise<Response>
  async function loginSimple(request: Request, env: Env): Promise<Response>
  ```
- **Data & Schema Fields**: 가입·로그인 JSON `{nickname:string,pin:string}`. 응답은 `SessionDto = {user:PublicUser,progress:ProgressDto}`. 닉네임은 Unicode NFKC 정규화 후 앞뒤 공백 제거, 2~20 Unicode 문자, 문자·숫자·`_`·`-`만 허용한다. `nickname_key`는 정규화 결과의 locale-independent lowercase다. `pin`은 선행 0을 보존하는 문자열이며 `/^[0-9]{4}$/`만 허용한다. `users.pin_salt`는 CSPRNG 16 byte base64, `pin_hash`는 `PIN_PEPPER`와 결합한 PBKDF2-HMAC-SHA256 100,000회·32 byte 결과 base64다. 원문 PIN은 DB, 로그, 응답에 없다.
- **Execution Flow / Logic**:
  1. 가입 전 IP 단위 1시간 5회 상한, 로그인 전 닉네임 단위 15분 5회 실패와 IP 단위 15분 30회 실패 상한을 검사한다. IP는 `CF-Connecting-IP`의 원문 대신 `PIN_PEPPER` 기반 HMAC digest로 bucket key를 만든다. IP 헤더가 없으면 안전한 공통 bucket을 사용한다.
  2. 유효성 오류는 400, 이미 사용 중인 닉네임은 409, 제한 초과는 429다. 로그인 실패는 존재 여부를 노출하지 않는 동일한 401 메시지다. 없는 닉네임에도 더미 PIN 검증을 실행해 응답 차이를 줄인다.
  3. 성공 가입·로그인은 `users`의 간편 계정만 대상으로 한다. 성공 시 닉네임 실패 bucket을 지우고 I02 세션을 발급한다. Microsoft 계정의 표시 이름과 같은 닉네임은 허용된다.
  4. `PIN_PEPPER`가 없으면 가입·로그인을 503으로 거부한다. 고비용 해시의 Workers 무료 CPU 한도 적합성은 로컬·배포 smoke 검증에서 확인하고, 보안 수준을 낮추는 변경은 별도 판단 대상으로 남긴다.

### I02. 공통 세션과 API 접근

- Related Files:
  - `worker/auth/session.ts` :: `issueSession`, `readSession`, `clearSession`, `requireSession`, `assertSameOriginJson` — Cookie·DB 세션; new
  - `worker/index.ts` :: `fetch` — `/api/auth/simple/register`, `/api/auth/simple/login`, `/api/auth/logout`, `/api/me` 연결; modify
  - `src/api/contracts.ts` :: `SessionDto` — `user`와 `progress` 응답; modify
  - `worker/auth/session.test.ts` :: session/CSRF tests — 만료·로그아웃·Origin 차단; new

#### Details

- **Signatures & Types**:
  ```typescript
  interface SessionDto { user: PublicUser; progress: ProgressDto }
  async function issueSession(env: Env, userId: string, nowMs: number): Promise<{ cookie: string }>
  async function readSession(request: Request, env: Env, nowMs: number): Promise<SessionPrincipal | null>
  async function clearSession(request: Request, env: Env): Promise<Response>
  function assertSameOriginJson(request: Request): void
  ```
- **Data & Schema Fields**: Cookie 이름은 `__Host-maze_session`, 무작위 32 byte token, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`. D1에는 SHA-256 token hash와 `user_id`, `created_at_ms`, `expires_at_ms`만 저장한다. `SessionPrincipal = {userId:string,authType:AuthType,displayName:string}`. 만료는 7일이며 자동 연장하지 않는다.
- **Execution Flow / Logic**:
  1. 모든 JSON POST는 `Content-Type: application/json`과 요청 `Origin === URL(request.url).origin`을 검사한다. 불일치는 403, 잘못된 content type은 415다. 인증 전 공개 가입·로그인에도 동일하게 적용한다.
  2. `GET /api/me`는 유효한 세션의 `user` 및 현재 `users.unlocked_stage`와 `stage_records`로 만든 `progress`를 반환한다. 없거나 만료된 세션은 401. `POST /api/auth/logout`은 세션 DB 행과 Cookie를 제거하고 204를 반환한다.
  3. `requireSession`은 DB에서 사용자와 인증 유형을 조회한다. 프런트에서 전달한 auth type, user ID는 권한 판단에 쓰지 않는다.
  4. 세션 응답은 항상 `Cache-Control: no-store`. 로그인과 로그아웃 뒤의 `Set-Cookie` 속성을 테스트한다.

## Acceptance Criteria

- [x] 닉네임·4자리 PIN으로 가입·재로그인이 되고 같은 닉네임 중복을 막는다.
- [x] PIN 원문과 세션 token 원문은 DB에 없다.
- [x] 잘못된 PIN 반복, 다른 Origin POST, 만료 세션이 차단된다.
- [x] 신규 계정의 `progress`는 1단계·빈 기록이다. 기존 브라우저 v6 저장을 가져오지 않는다.

## Validation

- `npm.cmd test -- --run worker/auth/simple.test.ts worker/auth/session.test.ts` — 가입·인증·제한·Cookie·Origin 검증 통과
- `npm.cmd run lint` — 앱·Worker 타입 검사 통과
- `npm.cmd run build` — 배포 자산 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(auth): 간편 계정 로그인과 서버 세션 추가

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P01-auth-and-record-api
Task: T02-simple-account-auth

- 솔트 적용 PIN 검증과 로그인 시도 제한 추가
- HttpOnly 세션 발급과 동일 출처 JSON 요청 검사
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 4040c79

## Follow-up: 만료 세션 자동 정리 (2026-10-06)

- Status: done
- 파일·심볼: `worker/auth/session.ts`의 `purgeExpiredSessions`, `readSession`; `worker/index.ts`의 `scheduled`; `wrangler.jsonc`의 `triggers.crons`; `migrations/0002_sessions_expiry_index.sql`의 `sessions_expiry_idx`; `worker/test/createTestEnv.ts`, `worker/auth/session.test.ts`.
- 동작: 매일 00:00 UTC 예약 실행에서 `expires_at_ms <= scheduledTime` 행을 삭제한다. 만료 쿠키가 사용되면 해당 세션 행도 즉시 삭제한다.
- 검증: Worker 테스트 16개, `npm.cmd run lint`, `npm.cmd run build`, 로컬 D1 migration, Wrangler 예약 실행 `outcome: ok`, `git diff --check` 통과.
- Commit: `813e44c` (`fix(auth): 만료된 세션을 매일 정리`)
