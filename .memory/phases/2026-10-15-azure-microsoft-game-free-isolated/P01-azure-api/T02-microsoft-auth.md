# Task: T02 Microsoft OIDC 로그인과 Azure 세션

## Status: done

## Goal

Azure API에서 Microsoft 개인·회사·학교 계정의 ID 토큰을 검증하고 Azure Cosmos에 독립 세션을 저장한다. 표시 이름은 검증된 Microsoft `name` 클레임에서만 가져온다.

## Decision Summary

- Azure Static Web Apps Free의 사용자 헤더에는 랭킹용 표시 이름을 보장하는 클레임이 없다. Azure 앱 전용 Entra 등록 + 서버 OIDC authorization code/PKCE 흐름을 사용한다.
- `common`으로 로그인 시작, 실제 `tid`에 맞춘 issuer와 Microsoft 키로 ID 토큰 검증. Cloudflare 쿠키가 Azure 기본 도메인에 전달되지 않으므로 새 서비스의 세션은 독립적이다.

## Commit Scope Guard

`.memory/`는 로컬 전용으로 상태만 갱신하고 스테이징하지 않는다. 커밋 직전 index를 확인해 Cloudflare 관련 파일이나 다른 작업의 변경을 포함하지 않는다. 이 Task의 구현 파일만 명시적 pathspec으로 커밋한다.

## Implementation

### I01. OIDC 시작·콜백

- Related Files:
  - `azure/api/src/auth/microsoft.ts` :: `startMicrosoftLogin`, `finishMicrosoftLogin`, `verifyMicrosoftIdToken` — new
  - `azure/api/src/auth/microsoft.test.ts` :: 로그인 검증/재생 방지 — new
  - `worker/auth/microsoft.ts` :: 기존 OIDC 동작 참조; read-only
  - `azure/api/src/config.ts`, `azure/api/src/model.ts` :: 설정·스토어 계약; read-only unless required to fix contract

#### Details

- **Signatures & Types**:
  ```typescript
  interface MicrosoftIdentity { tid: string; sub: string; displayName: string }
  async function startMicrosoftLogin(request: Request, store: AzureStore, config: AzureConfig, nowMs: number): Promise<Response>
  async function verifyMicrosoftIdToken(token: string, nonce: string, clientId: string, fetcher?: typeof fetch): Promise<MicrosoftIdentity>
  async function finishMicrosoftLogin(request: Request, store: AzureStore, config: AzureConfig, nowMs: number, fetcher?: typeof fetch): Promise<Response>
  ```
- `state`, `nonce`, PKCE verifier는 각 32바이트 CSPRNG 기반 base64url 값. `flow` TTL 600초. state의 SHA-256 키만 Cosmos에 저장하고 원문은 `__Host-maze_azure_oauth` 쿠키에 `Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`으로 저장한다.
- 시작 URL: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`, `response_type=code`, `scope=openid profile`, `code_challenge_method=S256`, `redirect_uri=${PUBLIC_ORIGIN}/api/auth/microsoft/callback`.
- 콜백에서 query state와 쿠키 state를 동일성/형식 검사하고 flow를 ETag 조건으로 일회성 소비한다. `error` 쿼리, 만료, 재사용, 코드 없음은 실패 리다이렉트. `common` token endpoint에 `client_id`, 서버 secret, code, verifier, 정확한 redirect URI를 POST한다. 원격 오류의 body/secret을 클라이언트나 로그에 출력하지 않는다.
- `jose`로 RS256 서명, audience, exp, nonce, `tid`, `sub`, `iss=https://login.microsoftonline.com/{tid}/v2.0` 확인. JWK의 tenant 한정 issuer 또는 `{tenantid}` template를 확인한다. 조작된 `tid`로 다른 issuer 키를 받아들여서는 안 된다. `name` 누락 시 `Microsoft 사용자`, 제어 문자 제거·80자 제한. `tid`/`sub`를 키로 UserDoc을 생성/조회하고 표시 이름만 최신화한다.
- 성공: OAuth 쿠키 제거 + 세션 쿠키 설정, `${PUBLIC_ORIGIN}/microsoft`로 302. 실패: OAuth 쿠키 제거, `${PUBLIC_ORIGIN}/microsoft?error=login_failed`로 302. 두 경우 `Cache-Control: no-store`. 비밀값이 없으면 시작 단계는 503 `microsoft_unavailable`; 잘못된 origin은 403. 응답에는 사용자 토큰이나 Cosmos 키를 포함하지 않는다.

### I02. 세션·보호 API 기반

- Related Files:
  - `azure/api/src/auth/session.ts` :: `issueSession`, `readSession`, `requireSession`, `clearSession`, `assertSameOriginJson`, `sessionDto` — new
  - `azure/api/src/auth/session.test.ts` :: 만료·쿠키·CSRF 테스트 — new
  - `src/api/contracts.ts` :: `SessionDto`, `ApiError` — read-only
  - `worker/auth/session.ts` :: 기존 클라이언트 계약 참조; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface AzurePrincipal { userId: string; displayName: string; authType: 'microsoft' }
  async function issueSession(store: AzureStore, userId: string, nowMs: number): Promise<string> // Set-Cookie 값
  async function readSession(request: Request, store: AzureStore, nowMs: number): Promise<AzurePrincipal | null>
  async function requireSession(request: Request, store: AzureStore, nowMs: number): Promise<AzurePrincipal>
  async function clearSession(request: Request, store: AzureStore): Promise<Response>
  function assertSameOriginJson(request: Request, publicOrigin: string): void
  async function sessionDto(store: AzureStore, principal: AzurePrincipal): Promise<SessionDto>
  ```
- `__Host-maze_azure_session`은 32바이트 난수 원문을 브라우저에만 `Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`으로 보낸다. Cosmos에는 SHA-256 해시 및 `expiresAtMs`/TTL 7일만 저장한다. `readSession`은 만료를 직접 검사하고 user 존재도 확인한다. 삭제 지연된 Cosmos TTL 행은 인증에 사용하지 않는다. `clearSession`은 해시 행을 삭제하고 Max-Age=0을 설정한다.
- 상태 변경 POST는 `Origin===PUBLIC_ORIGIN`, `Content-Type: application/json`을 요구한다. Microsoft redirect GET은 별도 state/nonce 검사로 보호한다. 세션 없는 `/api/me`, `/api/runs/*`, `/api/leaderboard`는 401 `unauthorized`; `SessionDto.user.authType`은 항상 `microsoft`, progress는 UserDoc의 `unlockedStage`/`stageRecords`로 매핑한다.
- 오류 형식은 기존 `{error:{code,message}}`를 유지한다. 로그아웃은 204. 미설정/네트워크/토큰 검증 실패를 인증 성공으로 취급하지 않는다. 브라우저 쿠키와 CORS 전달 여부는 P03 실제 origin에서 검증한다.

## Acceptance Criteria

- [x] 개인·조직 계정용 OIDC 흐름의 state/nonce/PKCE/서명/issuer/audience/만료를 검사한다.
- [x] 표시 이름은 검증된 ID 토큰에서만 오고 기존 계정 기록은 재로그인 시 유지된다.
- [x] 세션 만료·로그아웃·CSRF 거부와 OAuth 콜백 재사용 거부가 테스트된다.

## Validation

- `npm.cmd test -- --run azure/api/src/auth/microsoft.test.ts azure/api/src/auth/session.test.ts` — 토큰 위조, 만료, 재생, 정상 흐름 통과
- `npm.cmd run lint:azure-api` — API 타입 검사 통과
- `npm.cmd run build:azure-api` — OIDC/세션 코드 Node 빌드 통과

## Commit Message

```text
feat(azure): Microsoft 인증과 독립 세션 구현

Plan: 2026-10-15-azure-microsoft-game-free-isolated
Phase: P01-azure-api
Task: T02-microsoft-auth

- Microsoft ID 토큰을 검증하고 표시 이름 보존
- Azure 전용 쿠키 세션과 만료 검증 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: f4a0bcd
