# Task: T01 Azure Functions 프로젝트와 Cosmos 저장소

## Status: done

## Goal

기존 D1에 접속하지 않는 Azure API 프로젝트와 검증 가능한 Cosmos 저장소를 만든다. 이후 인증·게임 작업이 같은 데이터 모델을 사용하도록 한다.

## Decision Summary

- 대상은 새 Azure 앱 전용이다. `worker/`, `wrangler.jsonc`, 기존 D1 마이그레이션을 수정하지 않는다.
- 한 Cosmos 계정 아래 `maze-rescue` 데이터베이스에 **공유 수동 400 RU/s**를 할당하고 `game`, `auth` 두 컨테이너에는 전용 처리량을 할당하지 않는다. 둘 다 파티션 키 `/scope`, 값 `microsoft`를 사용한다. 이 작은 서비스에서 원자적 게임 기록 갱신과 단일 파티션 랭킹 조회를 얻기 위한 설계다. 논리 파티션 20GB 상한과 RU 사용량은 배포 후 관찰한다.

## Commit Scope Guard

`.memory/`는 로컬 전용으로 상태만 갱신하고 스테이징하지 않는다. 커밋 직전 index를 확인해 Cloudflare 관련 파일(`.dev.vars.example`, `README.md`, `docs/deployment.md`, `wrangler.jsonc`)이나 다른 작업의 변경을 포함하지 않는다. 구현한 파일만 명시적 pathspec으로 커밋한다.

## Implementation

### I01. Azure 프로젝트와 설정 계약

- Related Files:
  - `azure/api/package.json` :: `main`, `scripts`, dependencies — Azure Functions v4 앱; new
  - `azure/api/host.json` :: `version` — Functions v4 호스트; new
  - `azure/api/tsconfig.json` :: compiler options — Node 및 테스트 타입 검사; new
  - `azure/api/src/config.ts` :: `loadConfig` — 필수 앱 설정을 검증; new
  - `azure/api/src/config.test.ts` :: 설정 오류/비밀값 노출 방지 검증 — new
  - `package.json`, `package-lock.json` :: Azure 전용 개발/검증 스크립트 또는 workspace 연결 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface AzureConfig {
    cosmosEndpoint: string
    cosmosKey: string
    cosmosDatabase: 'maze-rescue'
    publicOrigin: string
    microsoftClientId: string
    microsoftClientSecret: string
  }
  function loadConfig(env: NodeJS.ProcessEnv): AzureConfig
  ```
- `COSMOS_ENDPOINT`, `COSMOS_KEY`, `PUBLIC_ORIGIN`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`은 서버 앱 설정에서만 읽는다. 키와 secret은 브라우저 빌드 환경 변수로 만들지 않는다. `PUBLIC_ORIGIN`은 슬래시 없는 HTTPS origin이며 localhost 개발에서만 HTTP를 허용한다. 누락/형식 오류는 비밀값을 출력하지 않는 설정 오류로 처리한다.
- Node 20 지원 관리형 Functions와 `@azure/functions`, `@azure/cosmos`, `jose`를 사용한다. Functions 엔트리는 다음 태스크에서 등록한다. 루트 `npm run build`/`deploy`의 Cloudflare 의미는 유지하고 Azure용 이름을 별도로 쓴다. API 소스가 루트 `tsconfig.app.json`의 브라우저 빌드에 섞이지 않도록 별도 TypeScript 프로젝트를 둔다.
- API 패키지의 Node 런타임/의존성 잠금 파일을 재현 가능하게 만들고, `npm.cmd run lint:azure-api`, `npm.cmd run build:azure-api`, `npm.cmd test -- --run azure/api`를 각 태스크에서 쓸 수 있게 한다. 아직 HTTP 라우트가 없는 단계에서도 빌드와 타입 검사가 통과해야 한다.

### I02. 문서 스키마와 저장소

- Related Files:
  - `azure/api/src/model.ts` :: `UserDoc`, `AttemptDoc`, `SessionDoc`, `OAuthFlowDoc`, `AzureStore` — new
  - `azure/api/src/cosmosStore.ts` :: `createCosmosStore`, `CosmosStore` — new
  - `azure/api/src/cosmosStore.test.ts` :: `CosmosStore` contract tests — new
  - `src/api/contracts.ts` :: `ProgressDto`, `LeaderboardDto` — read-only
  - `worker/game/runs.ts`, `worker/game/leaderboard.ts`, `worker/auth/session.ts` — behavior reference; read-only

#### Details

- **Data & Schema Fields** (Cosmos camelCase, ISO가 아닌 숫자 epoch ms):
  ```typescript
  type StageRecordMap = Record<string, { bestTimeSeconds: number }> // keys '1'…'20'
  interface UserDoc {
    id: string                // 'u_' + sha256(tid + ':' + sub)의 hex; Entra 주체별 결정적 ID
    scope: 'microsoft'
    type: 'user'
    tid: string
    sub: string
    displayName: string
    unlockedStage: number     // default 1
    highestStage: number      // default 0
    bestTimeSeconds: number | null
    rankTimeSeconds: number   // 미완료 시 2147483647, 그 외 최고 단계 최단 시간
    stageRecords: StageRecordMap // default {}
    createdAtMs: number
    updatedAtMs: number
    _etag?: string
  }
  interface AttemptDoc {
    id: string                // 'a_' + UUID
    scope: 'microsoft'
    type: 'attempt'
    userId: string
    stage: number
    startedAtMs: number
    finishedAtMs?: number
    status: 'active' | 'finished'
    ttl: number              // 시작 시 86400초, 완료 후 2592000초
    _etag?: string
  }
  interface SessionDoc {
    id: string               // 's_' + SHA-256(raw 32-byte token) hex
    scope: 'microsoft'
    type: 'session'
    userId: string
    createdAtMs: number
    expiresAtMs: number
    ttl: number              // 604800초
  }
  interface OAuthFlowDoc {
    id: string               // 'f_' + SHA-256(state) hex
    scope: 'microsoft'
    type: 'oauthFlow'
    nonce: string
    codeVerifier: string
    createdAtMs: number
    expiresAtMs: number
    ttl: number              // 600초
    _etag?: string
  }
  ```
- `game`은 UserDoc/AttemptDoc, `auth`는 SessionDoc/OAuthFlowDoc을 저장한다. 두 컨테이너의 `defaultTtl`은 `-1`로 켜고 문서별 `ttl`로 만료를 설정한다. UserDoc에는 `ttl`이 없어 보존된다. TTL 삭제는 지연될 수 있으므로 조회 시 `expiresAtMs` 및 `startedAtMs`도 검사한다.
- **Signatures & Types**:
  ```typescript
  interface AzureStore {
    getUser(id: string): Promise<UserDoc | null>
    getOrCreateMicrosoftUser(tid: string, sub: string, displayName: string, nowMs: number): Promise<UserDoc>
    replaceUser(user: UserDoc, etag: string): Promise<UserDoc>
    getAttempt(id: string): Promise<AttemptDoc | null>
    createAttempt(doc: AttemptDoc): Promise<void>
    finishAttemptAndUser(attempt: AttemptDoc, user: UserDoc): Promise<'ok' | 'conflict'>
    topUsers(limit: 100): Promise<UserDoc[]>
    countBetterUsers(highestStage: number, bestTimeSeconds: number | null): Promise<number>
    putFlow(doc: OAuthFlowDoc): Promise<void>
    takeFlow(id: string, nowMs: number): Promise<OAuthFlowDoc | null>
    putSession(doc: SessionDoc): Promise<void>
    getSession(id: string): Promise<SessionDoc | null>
    deleteSession(id: string): Promise<void>
  }
  function createCosmosStore(config: Pick<AzureConfig, 'cosmosEndpoint' | 'cosmosKey' | 'cosmosDatabase'>): AzureStore
  ```
- **Execution Flow / Logic**:
  1. 모든 point read/replace/delete에 `scope='microsoft'`를 준다. `getOrCreateMicrosoftUser`는 결정적 ID로 `create`하고 409 충돌이면 기존 사용자를 읽어 `displayName`만 ETag 조건으로 갱신한다. 기존 진행과 기록을 초기화하지 않는다. 이름은 trim, 제어문자 제거, 최대 80자, 비어 있으면 `Microsoft 사용자`로 처리한다.
  2. `finishAttemptAndUser`는 `game` 동일 파티션에서 두 문서의 ETag 조건부 replace를 **하나의 transactional batch**로 실행한다. 충돌은 `'conflict'`로 반환해 상위에서 재조회/재시도하며, 다른 오류는 전파한다. 중간에 user만 갱신되거나 attempt만 완료되는 상태를 허용하지 않는다.
  3. `topUsers`는 `type='user'` 필터 후 `highestStage DESC`, `rankTimeSeconds ASC`, `id ASC`로 최대 100개를 조회한다. Cosmos composite index `/highestStage` Desc, `/rankTimeSeconds` Asc, `/id` Asc를 인프라 태스크에서 생성한다. `countBetterUsers`는 최고 단계가 높거나 같은 단계에서 시간이 더 짧은 사용자 수를 센다. 동시간은 공동 순위이며 id는 화면 순서만 결정한다. 미완료 계정은 0단계와 `null` 시간을 쓴다.
  4. `takeFlow`는 state 해시 키로 조회하고 만료를 확인한 뒤 ETag 조건부 삭제로 한 번만 소비한다. 동시 콜백 중 하나만 성공한다. 세션은 토큰 원문이 아닌 해시만 저장한다. 스토어는 API/비즈니스 오류 코드로 Azure SDK 내부 오류를 무분별하게 노출하지 않는다.
- 테스트는 Cosmos SDK 목 객체보다 독립 저장소 계약용 in-memory 구현 또는 SDK 경계 주입을 사용해 결정적 ID, 기존 기록 보존, ETag 충돌, 일회성 flow, 100명 제한/동순위 계산 입력, 만료 거부에 실질적으로 대응한다. 실제 서비스 연결 검증은 P03에서 한다.

## Acceptance Criteria

- [ ] Azure API만 `@azure/cosmos`를 사용하며 기존 Worker/D1 파일은 바뀌지 않는다.
- [ ] 네 문서 형식, 두 컨테이너, `/scope`, TTL, 조건부 원자 갱신을 명시적으로 구현한다.
- [ ] API 빌드와 저장소 계약 테스트가 통과한다.

## Validation

- `npm.cmd run lint:azure-api` — API TypeScript 타입 검사 통과
- `npm.cmd run build:azure-api` — Functions용 Node 산출물 생성
- `npm.cmd test -- --run azure/api/src/cosmosStore.test.ts` — 저장소 불변식 통과
- `npm.cmd test -- --run azure/api/src/config.test.ts` — 설정 검증 및 비밀값 비노출 통과
- `git diff -- worker wrangler.jsonc migrations` 및 `git diff --cached -- worker wrangler.jsonc migrations` — 기존 서버 파일이 이 태스크 커밋에 포함되지 않는지 확인

## Commit Message

```text
feat(azure): Cosmos 저장소와 Functions 프로젝트 기반 추가

Plan: 2026-10-15-azure-microsoft-game-free-isolated
Phase: P01-azure-api
Task: T01-cosmos-foundation

- Azure 전용 데이터 모델과 설정 계약 정의
- 공유 처리량 DB용 Cosmos 저장소와 원자 갱신 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 67364ec
