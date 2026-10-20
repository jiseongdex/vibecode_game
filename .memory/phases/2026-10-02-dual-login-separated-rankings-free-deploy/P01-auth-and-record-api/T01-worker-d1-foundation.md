# Task: T01 Worker·D1 기반

## Status: done

## Goal

현재 Vite 앱을 Cloudflare Worker 정적 자산과 API가 함께 배포되는 구조로 만들고, 계정·세션·도전·단계 기록의 D1 스키마와 공유 API 타입을 마련한다. 이 Task에서는 실제 로그인이나 게임 기록 제출을 아직 열지 않는다.

## Decision Summary

- 한 무료 Workers 배포에서 `/microsoft`, `/simple` SPA 경로와 `/api/*` 서버 경로를 제공한다. DB는 D1이다.
- 기존 `src/game/campaignProgress.ts`의 `unlockedStage`, `stageRecords[stage].bestTimeSeconds` 및 `src/game/stageConfig.ts`의 1~20단계를 계약의 기준으로 삼는다.

## Implementation

### I01. Worker 설정과 빌드 경계

- Related Files:
  - `package.json` :: `scripts`, `devDependencies` — `wrangler`, `@cloudflare/workers-types`, `miniflare`, Worker 타입 검사 명령 추가; modify
  - `package-lock.json` :: lockfile — 의존성 고정; modify
  - `wrangler.jsonc` :: `main`, `assets`, `d1_databases` — 정적 파일, SPA fallback, D1 바인딩; new
  - `tsconfig.worker.json` :: `compilerOptions` — Worker Web API 타입과 `worker/**`, 공유 계약 파일 검사; new
  - `tsconfig.json` :: `references` — Worker 프로젝트 타입 검사 포함; modify
  - `.gitignore` :: ignore rules — `.wrangler/`, `.dev.vars`를 버전 관리에서 제외; modify

#### Details

- **Signatures & Types**: `npm.cmd run lint`와 `npm.cmd run build`는 기존 앱·Vite 설정과 새 Worker TypeScript를 모두 검사한다. `npm.cmd run dev:worker`는 Vite 빌드 후 `wrangler dev`를 실행한다. `npm.cmd run deploy`는 빌드 후 `wrangler deploy`를 실행한다. 실제 원격 배포는 P03에서만 한다.
- **Data & Schema Fields**: `wrangler.jsonc`의 `name`은 `maze-rescue-game`, `main`은 `worker/index.ts`, `compatibility_date`는 `2026-10-02`, `assets.directory`는 `./dist`, `assets.binding`은 `ASSETS`, `assets.not_found_handling`은 `single-page-application`, `assets.run_worker_first`는 `["/api/*"]`. D1 binding은 `DB`, database name은 `maze-rescue`; `database_id`는 로컬 개발용 명시적 placeholder UUID로 두고 P03에서 실제 ID로 대체한다. 비밀값은 설정 파일에 쓰지 않는다.
- **Execution Flow / Logic**:
  1. 필요한 dev dependency를 lockfile과 함께 설치한다.
  2. Worker 요청은 `/api/*`에만 코드로 응답하고 나머지는 assets binding의 SPA fallback이 처리한다. `/api/health`는 `{status:"ok"}` 200, 알 수 없는 API는 JSON 404다.
  3. 모든 API 응답에 `Cache-Control: no-store`를 기본으로 설정한다. 오류는 `ApiError` 계약을 따른다.
  4. `/microsoft`, `/simple` 직접 진입과 새로고침 시 `index.html`이 반환되는 설정을 유지한다.

### I02. D1 마이그레이션과 공유 계약

- Related Files:
  - `migrations/0001_initial.sql` :: `users`, `sessions`, `oauth_flows`, `auth_throttle`, `attempts`, `stage_records` — 최초 DB 구조; new
  - `src/api/contracts.ts` :: `AuthType`, `PublicUser`, `ApiError`, `ProgressDto`, `LeaderboardEntry`, `LeaderboardDto` — 브라우저·Worker 공용 DTO; new
  - `worker/types.ts` :: `Env`, `DbUser`, `SessionPrincipal` — D1 바인딩과 DB 행 타입; new
  - `worker/index.ts` :: `fetch`, `jsonResponse`, `errorResponse` — Worker 라우터 골격; new
  - `worker/test/createTestEnv.ts` :: `createTestEnv` — Miniflare 실제 로컬 D1 바인딩과 migration을 제공하는 API 테스트 헬퍼; new
  - `worker/index.test.ts` :: Worker health/404 tests — API 기본 응답 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  type AuthType = 'microsoft' | 'simple'
  interface PublicUser { id: string; authType: AuthType; displayName: string }
  interface ProgressDto { unlockedStage: number; stageRecords: Record<number, { bestTimeSeconds: number }> }
  interface LeaderboardEntry { rank: number; userId: string; displayName: string; highestStage: number; bestTimeSeconds: number }
  interface LeaderboardDto { top: LeaderboardEntry[]; current: LeaderboardEntry | null }
  interface ApiError { error: { code: string; message: string } }
  interface Env { DB: D1Database; ASSETS: Fetcher; MICROSOFT_CLIENT_ID?: string; MICROSOFT_CLIENT_SECRET?: string; PIN_PEPPER?: string }
  async function createTestEnv(): Promise<{ env: Env; dispose: () => Promise<void> }>
  ```
- **Data & Schema Fields**: 모든 시간은 Unix milliseconds `INTEGER`, 모든 ID는 UUID 문자열 `TEXT`다. `users(id PK, auth_type CHECK microsoft|simple, display_name, nickname_key nullable UNIQUE, microsoft_tid nullable, microsoft_sub nullable, pin_salt nullable, pin_hash nullable, unlocked_stage NOT NULL DEFAULT 1 CHECK 1..20, highest_completed_stage nullable CHECK 1..20, highest_stage_best_time_seconds nullable, created_at_ms, updated_at_ms)`; 랭킹용 두 nullable 필드는 함께 null 또는 함께 non-null이어야 하고 최고 완료 단계는 해금 단계 이하여야 한다. Microsoft 계정은 `(microsoft_tid,microsoft_sub)` 복합 UNIQUE, 간편 계정은 `nickname_key` UNIQUE. 두 유형의 전용 필드는 CHECK로 서로 배타적이다. `sessions(token_hash PK, user_id FK, created_at_ms, expires_at_ms)`; `oauth_flows(state_hash PK, nonce, code_verifier, created_at_ms, expires_at_ms)`; `auth_throttle(bucket_key PK, failures, window_started_at_ms, blocked_until_ms)`; `attempts(id PK, user_id FK, stage CHECK 1..20, started_at_ms, finished_at_ms nullable, status CHECK active|finished|abandoned)`; `stage_records(user_id FK, stage CHECK 1..20, best_time_seconds NOT NULL, updated_at_ms, PK(user_id,stage))`. `sessions`, `attempts`, `stage_records`에 사용자 조회 인덱스와 `users(auth_type,highest_completed_stage DESC,highest_stage_best_time_seconds ASC,id)` 랭킹 인덱스를 둔다.
- **Execution Flow / Logic**:
  1. FK를 켜고 생성 테이블과 인덱스를 하나의 순서 있는 migration에 넣는다.
  2. `ProgressDto`는 서버 데이터만 나타낸다. 기존 로컬 v6 데이터를 읽거나 업로드하는 API는 정의하지 않는다.
  3. `createTestEnv`는 Miniflare의 D1 binding에 `migrations/0001_initial.sql`을 적용해 테스트마다 격리된 DB를 반환한다. 테스트에서 health 200, 미등록 API JSON 404, `no-store`를 확인한다. 기존 Vitest 3 설정은 유지하고 Worker 테스트 파일에 Node 환경 지시자를 사용한다.
  4. 로컬 D1 migration 적용 후 테이블·인덱스 존재를 확인한다. placeholder remote ID로 원격 명령을 실행하지 않는다.

## Acceptance Criteria

- [x] 두 SPA 경로와 `/api/*`를 한 Worker 설정에서 제공할 수 있다.
- [x] D1 스키마에 인증 유형 구분·세션·도전·기록 키와 제약이 있다.
- [x] 기존 React 앱 빌드 및 Worker 타입 검사가 통과한다.
- [x] `.dev.vars`와 Wrangler 로컬 상태가 Git에 포함되지 않는다.

## Validation

- `npm.cmd test -- --run worker/index.test.ts` — health·404 계약 통과
- `npm.cmd exec -- wrangler d1 migrations apply maze-rescue --local` — 로컬 migration 적용
- `npm.cmd run lint` — 앱·Worker 타입 검사 통과
- `npm.cmd run build` — 정적 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(infra): Worker와 D1 기반 구축

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P01-auth-and-record-api
Task: T01-worker-d1-foundation

- SPA 정적 자산과 API 라우트를 하나의 Worker에 구성
- 계정과 기록을 위한 타입 계약과 D1 스키마 추가
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 90a2001
