# Task: T03 Azure 도전·진행·랭킹 API

## Status: done

## Goal

Azure Cosmos에서 서버 기준 도전 시작/완료, 단계 해금·최고 기록, Microsoft 전용 상위 100명과 내 순위를 계산한다. 기존 게임 클라이언트 DTO와 동작을 유지한다.

## Decision Summary

- 무작위 미로 기록도 랭킹에 반영한다. 서버는 시도 소유자/단계/시각/재사용 여부를 기본 검증하지만 이동 경로를 재연하지 않는다.
- 순위: 완료 최고 단계 내림차순, 같은 단계의 그 단계 최단 시간 오름차순. 동시간 공동 순위, 표시 순서는 user ID 오름차순. 기록 없는 사용자도 0단계로 내 순위를 가진다.

## Commit Scope Guard

`.memory/`는 로컬 전용으로 상태만 갱신하고 스테이징하지 않는다. 커밋 직전 index를 확인해 Cloudflare 관련 파일이나 다른 작업의 변경을 포함하지 않는다. 이 Task의 구현 파일만 명시적 pathspec으로 커밋한다.

## Implementation

### I01. 진행·시도 처리

- Related Files:
  - `azure/api/src/game/runs.ts` :: `readProgress`, `startRun`, `finishRun` — new
  - `azure/api/src/game/runs.test.ts` :: 게임 상태 전이/경합 테스트 — new
  - `azure/api/src/model.ts`, `azure/api/src/cosmosStore.ts` :: `AzureStore`, `UserDoc`, `AttemptDoc` — read-only or change only for tested missing primitive
  - `src/game/stageConfig.ts`, `src/api/contracts.ts` :: 1~20단계/시간/DTO 기준 — read-only
  - `worker/game/runs.ts` :: 기존 정책 기준 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  async function readProgress(store: AzureStore, userId: string): Promise<ProgressDto>
  async function startRun(request: Request, store: AzureStore, principal: AzurePrincipal, nowMs: number): Promise<Response>
  async function finishRun(request: Request, store: AzureStore, principal: AzurePrincipal, nowMs: number): Promise<Response>
  ```
- **Data & Schema Fields**: POST start `{stage:number}` → 201 `{attemptId:string,stage:number,startedAtMs:number}`. POST finish `{attemptId:string,clearTimeSeconds:number}` → 200 `{progress:{unlockedStage:number,stageRecords:Record<number,{bestTimeSeconds:number}>}}`. UserDoc `unlockedStage` 기본 1, `highestStage` 기본 0, `bestTimeSeconds` null, `rankTimeSeconds` sentinel 2147483647, `stageRecords` 키 `'1'`…`'20'`.
- **Execution Flow / Logic**:
  1. Start: JSON 객체, 정수 stage 1~20, `stage<=user.unlockedStage`를 확인한다. `a_`+UUID attempt를 `active`, `startedAtMs=nowMs`, `ttl=86400`으로 생성한다. 무작위 미로 seed는 기록하지 않는다. 잘못된 JSON 400 `invalid_request`, 범위 400 `invalid_stage`, 잠금 403 `stage_locked`, 사용자 없음 401.
  2. Finish: UUID 형식의 attempt ID와 소유자 일치/active 상태를 검사한다. 없는 ID나 타인 소유는 404 `attempt_not_found`, 완료된 시도는 409 `attempt_finished`. `clearTimeSeconds`는 정수, 2 이상, `getTimeLimitSeconds(stage)` 이하. 서버 경과 시간이 2초 이상이고 `clearTimeSeconds <= elapsedMs/1000+2`여야 한다. 실패는 422 `invalid_clear_time`이며 attempt를 소비하지 않는다. 시작 후 24시간 지난 attempt는 TTL 삭제 지연 여부와 무관하게 거부한다.
  3. 기록 갱신: 해당 stage 기록은 기존보다 짧을 때만 교체. `unlockedStage=max(현재, min(20,stage+1))`. `highestStage`보다 높은 stage면 최고 단계와 시간을 교체; 같은 stage면 짧은 시간 사용; 낮은 stage면 최고 단계/시간 유지. `rankTimeSeconds`는 현재 최고 단계 시간과 동일한 숫자. attempt는 `finished`, `finishedAtMs=nowMs`, `ttl=2592000`으로 교체한다.
  4. UserDoc과 AttemptDoc을 `finishAttemptAndUser`의 한 transactional batch로 조건부 갱신한다. ETag 충돌 시 최신 상태를 다시 읽어 최대 3회 재계산한다. 이미 완료됐다면 409, 여러 시도 병행으로 user만 변경됐다면 새 상태에 대해 다시 계산한다. 재시도 뒤에도 경합이면 409 `conflict` 또는 재시도 가능 503을 명시적으로 반환하고 부분 성공으로 답하지 않는다.
  5. 성공 후 저장된 UserDoc을 다시 읽어 `FinishRunDto.progress`를 반환한다. 오류 응답은 `Cache-Control:no-store`.

### I02. 상위 100명·내 순위

- Related Files:
  - `azure/api/src/game/leaderboard.ts` :: `getLeaderboard`, `rankEntries` — new
  - `azure/api/src/game/leaderboard.test.ts` :: 동순위/0단계/101위 테스트 — new
  - `azure/api/src/cosmosStore.ts` :: `topUsers`, `countBetterUsers` — read-only or narrow query/index fix with test
  - `worker/game/leaderboard.ts` :: 현재 DTO/순위 기준 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  async function getLeaderboard(store: AzureStore, principal: AzurePrincipal): Promise<LeaderboardDto>
  function rankEntries(users: UserDoc[], precedingBetterCount?: number): LeaderboardEntry[]
  ```
- 상위 조회는 Cosmos `game` 파티션의 `type='user'`만 대상으로 한다. 다른 서비스나 계정 유형을 쿼리하지 않는다. `topUsers(100)` 결과의 순위를 **더 좋은 최고 단계 또는 같은 단계의 더 짧은 시간** 수 +1로 계산한다. 동시간 user는 같은 rank. 기록이 없는 user의 `bestTimeSeconds=null` 유지.
- `current`는 현재 UserDoc을 point read하고 `countBetterUsers` 결과+1로 만든다. 내 계정이 상위 100에 있어도 표시한다. 사용자가 삭제/없음이면 401. API에 `top` 최대 100, `current` 1개 또는 null을 반환한다. Microsoft 이름은 저장된 검증 이름이다.
- 100위 경계에서 동시간의 전체 공동 순위가 잘리지 않도록 `rankEntries`는 표시된 상위 목록의 rank를 같은 정렬 기준으로 부여한다. `current` rank는 DB count로 전체 대상 기준을 계산한다. 최종 UI가 10명씩 페이지를 나누는 것은 클라이언트 역할이다.

## Acceptance Criteria

- [x] 1단계 완료 뒤 2단계가 해금되고 단계별 최단 기록이 유지된다.
- [x] 동일 attempt 두 번 완료 또는 동시 완료에서 기록이 중복/부분 반영되지 않는다.
- [x] 랭킹은 최고 단계→그 단계 최단 시간 기준이며 0단계, 공동 순위, 101위의 내 순위가 맞다.

## Validation

- `npm.cmd test -- --run azure/api/src/game/runs.test.ts azure/api/src/game/leaderboard.test.ts` — 상태·경합·순위 통과
- `npm.cmd run lint:azure-api` — API 타입 검사 통과
- `npm.cmd run build:azure-api` — 게임 API Node 빌드 통과

## Commit Message

```text
feat(azure): 게임 진행과 전용 랭킹 API 구현

Plan: 2026-10-15-azure-microsoft-game-free-isolated
Phase: P01-azure-api
Task: T03-game-api

- 시도 완료를 원자적으로 처리하고 단계별 기록 동기화
- 최고 단계와 시간 기준 상위 100명 및 내 순위 계산
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: c11e26b
