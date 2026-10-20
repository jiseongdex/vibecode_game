# Task: T04 서버 도전 및 계정 진행

## Status: done

## Goal

로그인 사용자가 시작한 단계 도전에 서버 발급 ID를 붙이고, 유효한 클리어만 계정별 해금 단계·최고 시간에 반영한다. 다른 기기에서 `GET /api/me`로 같은 진행을 읽을 수 있게 한다.

## Decision Summary

- 기존 브라우저 v6 기록은 계정에 업로드하지 않는다. 서버는 새 로그인 후 시작된 도전의 클리어만 받는다.
- 기본 검증은 단계 권한·서버 시작 시각·시간 범위·일회성 제출을 검사한다. 경로 재생 검증은 하지 않는다. 무작위 미로는 유지한다.

## Implementation

### I01. 서버 도전 발급과 완료 처리

- Related Files:
  - `worker/game/runs.ts` :: `startRun`, `finishRun`, `readProgress` — D1 도전과 진행 갱신; new
  - `worker/index.ts` :: `fetch` — `POST /api/runs/start`, `POST /api/runs/finish` 연결 및 T02 `requireSession` 적용; modify
  - `src/api/contracts.ts` :: `StartRunRequest`, `StartRunDto`, `FinishRunRequest`, `FinishRunDto` — 요청·응답 타입; modify
  - `worker/game/runs.test.ts` :: run/progress tests — 단계·시간·소유자·중복·동시 제출 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  interface StartRunRequest { stage: number }
  interface StartRunDto { attemptId: string; stage: number; startedAtMs: number }
  interface FinishRunRequest { attemptId: string; clearTimeSeconds: number }
  interface FinishRunDto { progress: ProgressDto }
  async function startRun(request: Request, env: Env, principal: SessionPrincipal, nowMs: number): Promise<Response>
  async function finishRun(request: Request, env: Env, principal: SessionPrincipal, nowMs: number): Promise<Response>
  async function readProgress(db: D1Database, userId: string): Promise<ProgressDto>
  ```
- **Data & Schema Fields**: `attempts.id`는 CSPRNG UUID, `user_id`는 세션에서만 취한다. `attempts.stage`는 1~20 정수, `started_at_ms`는 서버 시각, `status`는 `active`에서 `finished`로 한 번만 이동, `finished_at_ms`는 완료 시각이다. `stage_records`는 `(user_id,stage)`당 최소 `best_time_seconds` 하나를 가진다. `users.unlocked_stage`와 `highest_completed_stage`는 단조 증가하고, `highest_stage_best_time_seconds`는 해당 최고 단계에서 최소 시간만 보존한다.
- **Execution Flow / Logic**:
  1. 모든 POST는 T02 `assertSameOriginJson`과 `requireSession`을 통과해야 한다. `POST /api/runs/start`는 요청 stage가 정수 1~20이고 계정의 `unlocked_stage` 이하인지 DB에서 검증한다. 성공하면 active attempt를 삽입해 201과 `StartRunDto`를 반환한다. 다른 기기의 active attempt는 손대지 않는다.
  2. `POST /api/runs/finish`는 attempt ID로 행을 읽고 세션 `userId`의 active attempt인지 확인한다. 시간은 정수이며 `2 <= clearTimeSeconds <= getTimeLimitSeconds(stage)`여야 한다. 서버 wall time `(nowMs-started_at_ms)/1000`에 2초 관용을 더한 값보다 클라이언트 보고 시간이 길면 422로 거부한다. 서버 기준 시작 후 2초 미만 클리어도 422다. Pause 시간은 wall time에 포함하므로 정상적인 일시정지 기록은 통과한다.
  3. 하나의 D1 `batch` transaction에서 active attempt 조건부로 `stage_records`를 최소 시간 upsert, `users.unlocked_stage`를 `min(20,max(current,stage+1))`로 갱신, `users.highest_completed_stage`가 더 낮으면 새 stage/time으로 바꾸고 같으면 `highest_stage_best_time_seconds`의 최소값을 보존하며, attempt를 finished로 전환한다. 더 낮은 단계 재플레이는 랭킹 요약 필드를 바꾸지 않는다. 각 변경은 해당 attempt가 아직 active인 경우만 실행되도록 SQL을 구성하고 완료 전환 `changes=1`을 확인한다. 중복 제출은 기록을 다시 바꾸지 않고 409다.
  4. 현재 진행은 `users.unlocked_stage`와 `stage_records`에서만 구성한다. 로그인 타입이 달라도 로직은 같고 사용자 ID로만 기록을 쓴다. 기존 `src/persistence/saveStore.ts::mergeSaveData`는 이 API에서 호출하지 않는다.
  5. DB 오류는 500이며 성공으로 보고하지 않는다. 클라이언트가 응답을 잃고 재시도해 409를 받으면 `GET /api/me`로 실제 계정 진행을 다시 읽을 수 있다.

### I02. 진행과 시간의 경계 테스트

- Related Files:
  - `worker/game/runs.test.ts` :: `describe('run lifecycle')` — T01 Miniflare D1 harness에서 서버 clock을 주입한 테스트; modify
  - `worker/auth/session.test.ts` :: protected route tests — 401·403 경계; modify

#### Details

- **Data & Schema Fields**: 새 사용자는 `{unlockedStage:1,stageRecords:{}}`. 20단계 완료 후에도 `unlockedStage=20`. 같은 단계 재플레이에서 더 느린 기록은 기존 최단 시간을 유지한다.
- **Execution Flow / Logic**: 잠긴 단계 발급 거절, 다른 사용자 attempt 완료 거절, 0초·소수·제한시간 초과·서버 시작보다 긴 보고 시간 거절, 같은 attempt 이중 제출 거절, 다른 기기/세션에서 같은 사용자 진행 조회, 20단계 상한을 시험한다.

## Acceptance Criteria

- [x] 실제 서버 발급 attempt만 기록으로 바뀌며 계정 간 제출을 할 수 없다.
- [x] 단계 해금과 최고 기록이 원자적이고 단조롭게 갱신된다.
- [x] 이전 로컬 기록 업로드 API가 없다.
- [x] 기본 검증이 비정상 시간·중복 제출을 막고 결과 조회는 서버 진행을 돌려준다.

## Validation

- `npm.cmd test -- --run worker/game/runs.test.ts worker/auth/session.test.ts` — 경계·재시도·기록 갱신 통과
- `npm.cmd run lint` — Worker·앱 타입 검사 통과
- `npm.cmd run build` — 배포 자산 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(records): 도전 기록을 검증하고 계정 진행 저장

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P01-auth-and-record-api
Task: T04-attempts-and-progress

- 서버 발급 도전만 단계 완료 기록으로 인정
- D1 트랜잭션에서 해금 단계와 최고 시간 갱신
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `a39b697`
