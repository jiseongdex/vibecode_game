# Task: T04 Azure Functions 라우팅과 API 배포 산출물

## Status: done

## Goal

P01의 인증·게임 서비스를 Azure Static Web Apps의 관리형 Functions `/api`에서 제공하고, 배포 가능한 Node 프로젝트를 만든다.

## Decision Summary

- SWA Free 관리형 API는 HTTP Functions와 같은 origin의 `/api`를 제공한다. 별도 Azure Functions 리소스를 만들지 않는다.
- API는 Microsoft 로그인만 제공한다. `/api/auth/simple/*`는 404이고, 사용자/기록/랭킹은 서버 세션 없이는 401이다.

## Commit Scope Guard

`.memory/`는 로컬 전용으로 상태만 갱신하고 스테이징하지 않는다. 커밋 직전 index를 확인해 Cloudflare 관련 파일이나 다른 작업의 변경을 포함하지 않는다. 이 Task의 구현 파일만 명시적 pathspec으로 커밋한다.

## Implementation

### I01. HTTP 어댑터·명시적 엔드포인트

- Related Files:
  - `azure/api/src/index.ts` :: `app.http` registrations, `handleApi` — new
  - `azure/api/src/http.ts` :: `toWebRequest`, `toFunctionResponse`, `errorResponse` — new
  - `azure/api/src/index.test.ts` :: 라우트/응답/쿠키 전파 테스트 — new
  - `azure/api/src/auth/microsoft.ts`, `azure/api/src/auth/session.ts`, `azure/api/src/game/runs.ts`, `azure/api/src/game/leaderboard.ts` — read-only unless contract fix
  - `azure/api/package.json`, `azure/api/host.json`, `azure/api/tsconfig.json` — modify

#### Details

- **Signatures & Types**:
  ```typescript
  function toWebRequest(req: HttpRequest, publicOrigin: string): Promise<Request>
  function toFunctionResponse(response: Response): Promise<HttpResponseInit>
  function errorResponse(status: number, code: string, message: string): Response
  async function handleApi(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>
  ```
- 정확한 route/method: GET `health`, GET `auth/microsoft/start`, GET `auth/microsoft/callback`, POST `auth/logout`, GET `me`, GET `leaderboard`, POST `runs/start`, POST `runs/finish`. `app.http`의 `authLevel:'anonymous'`는 플랫폼 키 요구가 없다는 뜻이며, 자체 세션 검증을 위임하지 않는다. 나머지 `/api/*`는 404 JSON; 특히 simple 가입/로그인은 등록하지 않는다.
- Functions 요청 URL은 내부 호스트/프록시 헤더를 신뢰해 origin을 만들지 말고 설정된 `PUBLIC_ORIGIN`에 path/query를 합쳐 Web Request로 변환한다. 실제 POST `Origin` 헤더는 그대로 전달하고 `assertSameOriginJson`으로 검사한다. 요청 body 크기를 합리적 상한(예: 4KB)으로 제한하며 큰 payload는 413. `Cookie`, `Content-Type`을 보존한다.
- Web Response의 status, JSON/body, `Location`, `Cache-Control`, 각각의 `Set-Cookie`를 Functions `HttpResponseInit`에 정확히 매핑한다. **콜백 성공에는 OAuth 삭제 쿠키와 세션 발급 쿠키 두 개가 동시에 필요하다.** `Headers.getSetCookie()` 또는 별도 쿠키 구조를 사용하고 쉼표 결합으로 망가뜨리지 않는다. 리다이렉트 Location의 HTTPS origin을 유지한다.
- 요청 단위로 `loadConfig(process.env)` 후 `createCosmosStore`를 사용하되 SDK client를 모듈에서 재사용한다. 설정 오류는 503 `service_unavailable`이며 키/토큰을 출력하지 않는다. 도메인 오류는 `{error:{code,message}}` + `no-store`; 알 수 없는 오류는 500 일반 메시지로 처리하고 민감한 상세 정보는 사용자에게 노출하지 않는다. `GET /api/health`는 공개 200 `{status:'ok'}`지만 DB 비밀값/상태를 노출하지 않는다.
- `POST /api/auth/logout`도 같은 origin JSON 검사 후 세션 삭제. 로그인 시작/콜백은 GET 및 state/nonce 보호. 모든 보호 GET/POST는 세션을 요구한다.

### I02. 빌드·로컬 실행·배포 입력

- Related Files:
  - `azure/api/package.json` :: `main=dist/index.js`, `build`, production dependencies — modify
  - `azure/api/package-lock.json` :: exact dependencies — new
  - `azure/api/host.json` :: Azure Functions v4 — modify
  - `package.json` :: `build:azure-api`, `lint:azure-api` — modify
  - `scripts/build-azure-api.mjs` :: API build/staging if CLI needs it — new only if needed

#### Details

- Azure Functions Node v4가 로딩할 JS 엔트리를 실제로 만들고 `azure/api/package.json`의 `main`이 존재하는 빌드 산출물을 가리키게 한다. Node 20 호환으로 빌드한다. `@azure/functions`, `@azure/cosmos`, `jose` 런타임 의존성을 Azure API 패키지에 둔다.
- `npm.cmd run build:azure-api` 후 Functions Core Tools 또는 SWA CLI 로컬 호스트에서 `GET /api/health` 200, 비로그인 `GET /api/me` 401, 없는 `POST /api/auth/simple/login` 404가 되는지 확인한다. SWA CLI는 `swa start ./dist --api-location ./azure/api`, 배포는 `swa deploy ./dist --api-location ./azure/api` 형태를 사용한다. CLI가 빌드된 API 폴더를 요구하면 이 태스크에서 재현 가능한 staging 명령을 만들고 동일 검증을 반복한다.
- 현재 `npm run build`/`npm run deploy`는 Cloudflare용으로 유지한다. Azure 프로세스 실행에 `wrangler`나 Cloudflare D1 binding을 요구해서는 안 된다.

## Acceptance Criteria

- [x] `/api/health` 200, 비로그인 보호 API 401, simple API 404를 Functions 라우터에서 확인한다.
- [x] 두 `Set-Cookie`가 있는 OIDC 콜백과 logout 쿠키 제거를 HTTP 어댑터 테스트에서 확인한다.
- [x] Azure API 프로젝트가 Node 20 관리형 Functions에서 로드 가능한 구조로 빌드된다.

## Validation

- `npm.cmd test -- --run azure/api/src/index.test.ts` — 라우트/쿠키/오류 응답 통과
- `npm.cmd run lint:azure-api` — API 타입 검사 통과
- `npm.cmd run build:azure-api` — 배포 엔트리 생성
- `npm.cmd test -- --run` — 기존 Worker/React 회귀 포함 전체 테스트 통과

## Commit Message

```text
feat(azure): 관리형 Functions 라우터와 배포 빌드 추가

Plan: 2026-10-15-azure-microsoft-game-free-isolated
Phase: P01-azure-api
Task: T04-functions-host

- Microsoft 인증 및 게임 API를 Azure HTTP 경로에 연결
- 쿠키·오류 응답을 보존하는 Functions 빌드 구성
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: a0cd542
- 로컬 Functions/SWA 호스트 스모크는 CLI 미설치로 미실행; P03 실제 HTTPS 배포에서 재확인
