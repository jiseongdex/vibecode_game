# Task: T03 Microsoft OIDC 로그인

## Status: done

## Goal

개인 Microsoft 계정과 회사·학교 계정이 같은 `/microsoft` 경로에서 안전하게 로그인하도록 서버 측 OAuth 2.0 authorization code + PKCE/OIDC 흐름을 구현한다. 검증된 Microsoft 주체는 T02의 공통 세션을 사용한다.

## Decision Summary

- Microsoft 랭킹 이름은 ID token의 표시 이름이다. 이메일을 계정 고유 키나 랭킹 표시에 사용하지 않는다.
- Microsoft 개인·조직 계정을 모두 허용하고, 간편 계정과 데이터를 섞지 않는다. Graph API 권한은 요청하지 않는다.

## Implementation

### I01. Authorization 요청과 일회용 상태

- Related Files:
  - `package.json` :: `dependencies.jose` — 신뢰할 수 있는 JWT 서명 검증 라이브러리 추가; modify
  - `package-lock.json` :: lockfile — `jose` 버전 고정; modify
  - `worker/types.ts` :: `Env.MICROSOFT_CLIENT_ID`, `Env.MICROSOFT_CLIENT_SECRET`, `Env.PUBLIC_ORIGIN` — 설정 타입 및 실행 시 유효성; modify
  - `worker/auth/microsoft.ts` :: `startMicrosoftLogin`, `finishMicrosoftLogin`, `verifyMicrosoftIdToken` — OIDC 흐름; new
  - `worker/index.ts` :: `fetch` — `/api/auth/microsoft/start`, `/api/auth/microsoft/callback` 라우트; modify
  - `worker/auth/microsoft.test.ts` :: authorization/callback tests — 성공과 CSRF·claim 오류 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  function startMicrosoftLogin(request: Request, env: Env, nowMs: number): Promise<Response>
  function finishMicrosoftLogin(request: Request, env: Env, nowMs: number): Promise<Response>
  function verifyMicrosoftIdToken(idToken: string, expectedNonce: string, clientId: string): Promise<{ tid: string; sub: string; displayName: string }>
  ```
- **Data & Schema Fields**: `PUBLIC_ORIGIN`은 HTTPS 배포 origin이며 `new URL('/api/auth/microsoft/callback', PUBLIC_ORIGIN)`을 정확한 redirect URI로 사용한다. 로컬 `.dev.vars`에서는 `http://localhost` origin만 허용한다. `oauth_flows`에는 SHA-256 `state_hash`, 원문 `nonce`, 원문 `code_verifier`, 생성·만료 시각(10분)만 저장한다. Browser에는 `__Host-maze_oauth` state Cookie(`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`)를 준다. URL에는 code challenge S256, `scope=openid profile`, `response_type=code`, `response_mode=query`, nonce, state, client_id, redirect_uri를 넣는다.
- **Execution Flow / Logic**:
  1. `GET /api/auth/microsoft/start`: 환경값 누락은 503. CSPRNG state·nonce·PKCE verifier를 만들고 D1에 일회용 상태를 저장한 뒤 `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`로 302 이동한다. 외부 `returnTo`나 caller-supplied redirect URI는 받지 않는다.
  2. `GET /api/auth/microsoft/callback`: query의 state와 state Cookie가 같은지 확인하고 D1에서 만료 전 flow를 **원자적으로 소비**한다(`DELETE ... RETURNING`). code가 없거나 OAuth error, 재사용 state, Cookie 불일치는 실패한다.
  3. token endpoint `https://login.microsoftonline.com/common/oauth2/v2.0/token`에 code, client_id, client_secret, redirect_uri, code_verifier를 서버에서 전송한다. access/refresh token은 DB, Cookie, 로그에 저장하지 않는다.
  4. `id_token`의 미검증 `tid`는 GUID 정규식 통과 후 Microsoft tenant-specific OIDC 키 URL을 고르는 데만 사용한다. `jose.jwtVerify`로 Microsoft 서명, `aud=MICROSOFT_CLIENT_ID`, `iss=https://login.microsoftonline.com/{tid}/v2.0`, 만료·`nbf`를 검증하고, `nonce` 일치와 비어 있지 않은 `sub`를 확인한다. 서명 검증 전 claim을 인증 정보로 사용하지 않는다. `name` claim은 앞뒤 공백을 없애 표시 이름에 쓰고, 없으면 이메일 대신 `Microsoft 사용자`로 표기한다.
  5. `(microsoft_tid,microsoft_sub)`로 `users`를 upsert한다. 첫 로그인은 `unlocked_stage=1`, 기록 없음. 이후 로그인은 표시 이름만 갱신하고 기존 진행·기록을 유지한다. T02 `issueSession`을 호출해 Cookie를 발급하고 `/microsoft`로 302 이동한다. 성공·실패 모두 OAuth state Cookie를 삭제한다. 실패는 세부 토큰 값을 표시하지 않고 `/microsoft?error=login_failed`로 보낸다.

### I02. 개인·조직 계정과 보안 회귀 테스트

- Related Files:
  - `worker/auth/microsoft.test.ts` :: `describe('Microsoft login')` — test JWKS/가짜 token endpoint 주입 또는 fetch mock으로 두 tenant 유형 검증; modify
  - `worker/test/createTestEnv.ts` :: OAuth 테스트 secret/origin 설정; modify

#### Details

- **Data & Schema Fields**: 개인 계정 tenant GUID `9188040d-6c67-4c5b-b112-36a304b66dad`와 다른 유효한 조직 tenant GUID를 시험한다. 둘 다 `auth_type='microsoft'`이며 서로 다른 `(tid,sub)`는 별도 사용자다.
- **Execution Flow / Logic**: state 재사용·만료, nonce 불일치, 잘못된 audience/issuer/서명/tenant, code 교환 실패는 세션을 발급하지 않는다. 동일 Microsoft 사용자의 재로그인은 중복 users 행을 만들지 않는다. 다른 Microsoft 사용자와 같은 `name`도 내부 ID가 섞이지 않는다.

## Acceptance Criteria

- [x] 개인·회사·학교 계정에 공통 OIDC 로그인 흐름을 지원한다.
- [x] state·nonce·PKCE·서명·issuer·audience 검증을 통과한 ID token만 세션으로 바뀐다.
- [x] Microsoft 표시 이름은 랭킹용으로 저장되지만 이메일·토큰은 보관하지 않는다.
- [x] 기존 간편 계정과 동일 표시 이름이어도 사용자 및 랭킹 데이터가 분리된다.

## Validation

- `npm.cmd test -- --run worker/auth/microsoft.test.ts worker/auth/session.test.ts` — 두 tenant, 실패·재사용·서명 검증 통과
- `npm.cmd run lint` — Worker·앱 타입 검사 통과
- `npm.cmd run build` — 정적 자산 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(auth): Microsoft OIDC 로그인 추가

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P01-auth-and-record-api
Task: T03-microsoft-oidc

- 개인 및 조직 Microsoft ID 토큰 검증
- 일회용 OAuth 흐름을 공통 서버 세션에 연결
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `c81d355`
