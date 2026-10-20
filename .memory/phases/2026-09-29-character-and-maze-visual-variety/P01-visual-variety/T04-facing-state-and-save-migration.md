# Task: T04 플레이어·팔로워 방향 상태와 저장 이행

## Status: done

## Goal
방향별 스프라이트가 사용할 플레이어 시선과 팔로워별 실제 이동 방향을 게임 상태에 저장하고, 기존 v1 로컬 저장을 진행 손실 없이 v2로 변환한다.

## Decision Summary
- 막힌 벽을 향해 입력해도 플레이어 시선만 회전한다. 이동 횟수·위치·팔로워는 그대로 둔다.
- 팔로워는 각각 자신이 실제 이동한 방향을 보며, 새로 합류하거나 이동하지 않은 동물은 기본 방향 또는 직전 방향을 유지한다.
- v1 저장의 해금·기록·현재 미로·타이머·구조 상태를 보존한다. 테마는 기존 `maze.seed`로 추후 계산하므로 저장 필드가 필요 없다.

## Implementation

### I01. 게임 상태와 이동 처리

- Related Files:
  - `src/game/gameState.ts` :: `GameState`, `createGameState`, `gameReducer`, 신규 `directionFromStep`; modify
  - `src/game/types.ts` :: 기존 `Direction`, `Position`; read-only
  - `src/game/entityPlacement.ts` :: 기존 `moveFollowers`; read-only
  - `src/game/gameState.test.ts` :: 막힌 이동·팔로워 방향·재시작 회귀 검증; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface GameState {
    // 기존 필드는 그대로 유지
    playerFacing: Direction
    followerFacings: Direction[]
  }
  function directionFromStep(from: Position, to: Position): Direction | null
  function createGameState(stage: number, maze?: Maze): GameState
  function gameReducer(state: GameState, action: GameAction): GameState
  ```
- **Data & Schema Fields**:
  - `GameState.playerFacing`: `'up'|'right'|'down'|'left'`, 필수, 초기값 `'down'`.
  - `GameState.followerFacings`: `Direction[]`, 필수, 초기값 `[]`, 항상 `followers`와 길이 및 인덱스가 같다.
  - 기존 `followers: Position[]`, `rescues: RescueTarget[]`, `seed: number` 등의 의미와 순서는 유지한다.
- **Execution Flow / Logic**:
  1. `MOVE`는 기존처럼 `status === 'playing'`과 유효한 네 방향인지 먼저 확인한다. 다른 상태 또는 알 수 없는 방향은 기존 객체를 그대로 반환한다.
  2. 경계 또는 닫힌 벽이면 위치·카운트·구출 상태·팔로워는 바꾸지 않고 `playerFacing`만 `action.direction`으로 갱신한다. 이미 같은 방향이면 기존 객체를 그대로 반환해 불필요한 저장·렌더링을 피한다.
  3. 통과 가능한 이동이면 기존 이동·구출·승리 계산은 보존하고 `playerFacing = action.direction`으로 갱신한다. `moveFollowers(state.followers, state.player)`의 결과와 이동 전 `state.followers`의 같은 인덱스 위치 차이를 비교해 팔로워별 방향을 계산한다. 행 -1=`up`, 행 +1=`down`, 열 -1=`left`, 열 +1=`right`이며 같은 위치 또는 인접하지 않은 위치는 이전 `followerFacings[i] ?? 'down'`을 유지한다.
  4. 해당 이동에서 새 동물이 구조되어 `followers` 끝에 추가된 경우 새 방향은 `'down'`으로 넣는다. 이 동물이 이후 실제로 한 칸 움직일 때부터 계산한 방향을 사용한다. `followerFacings.length === followers.length`를 모든 이동 뒤에 지킨다.
  5. `createGameState`와 같은 미로 재도전·새 미로 재시작에서 새 게임 상태의 방향은 `down`/빈 배열로 초기화한다. 일시정지·이어하기·타이머 동작은 방향을 바꾸지 않는다.
- **Error & Exception Handling**: 기존 무효 방향·상태 입력은 무시한다. 이전 저장에서 위치가 겹치는 팔로워는 방향 계산이 `null`이면 직전 또는 기본 방향을 유지한다.

### I02. v1→v2 저장 스키마와 마이그레이션

- Related Files:
  - `src/persistence/saveSchema.ts` :: `SAVE_VERSION`, `SAVE_KEY`, `LEGACY_SAVE_KEY`, `SaveData`, `SaveDataV1`, `isSaveData`, `isSaveDataV1`; modify
  - `src/persistence/saveStore.ts` :: `loadSave`, `saveSave`, `clearSave`, 신규 `migrateV1Save`; modify
  - `src/persistence/saveStore.test.ts` :: v1 이어하기 보존, 새 필드 검증, 손상 데이터 회귀 검증; modify

#### Details
- **Signatures & Types**:
  ```typescript
  const SAVE_VERSION = 2 as const
  const SAVE_KEY = 'maze-rescue-game.save.v2'
  const LEGACY_SAVE_KEY = 'maze-rescue-game.save.v1'
  interface SaveDataV1 {
    version: 1
    unlockedStage: number
    currentSession: { state: Omit<GameState, 'playerFacing' | 'followerFacings'> & { status: 'paused' }; updatedAt: number } | null
    stageRecords: Record<number, StageRecord>
  }
  function isSaveData(value: unknown): value is SaveData
  function isSaveDataV1(value: unknown): value is SaveDataV1
  function migrateV1Save(save: SaveDataV1): SaveData
  function loadSave(): SaveData
  ```
- **Data & Schema Fields**:
  - v2 `SaveData.version`: 리터럴 `2`; 새 키는 `maze-rescue-game.save.v2`.
  - v2 `currentSession.state.playerFacing`: 필수 `Direction`; v2 `currentSession.state.followerFacings`: 필수 `Direction[]`, `followers.length`와 동일.
  - v1은 기존 필드·값을 그대로 검증한다. `currentSession: null`과 구조된 팔로워가 있는 현재 세션 모두 변환 대상이다.
- **Execution Flow / Logic**:
  1. 공통 기존 검증(단계 범위, 15~33 홀수 미로·seed·상호 벽 일치·모든 칸 연결, 구조 대상·타이머·기록·위치)을 v1에도 유지한다. v1 검증은 새 방향 필드를 요구하지 않으며, v2 검증은 유효한 방향 4개 및 팔로워 방향 배열 길이를 추가로 확인한다. 버전 숫자만 보고 미검증 객체를 변환하지 않는다.
  2. `loadSave`는 먼저 v2 키를 파싱·검증한다. 유효하면 즉시 반환한다. v2 키가 없거나 손상됐을 때만 v1 키를 파싱·검증한다. 유효한 v1은 모든 기존 진행 필드와 `updatedAt`을 유지하고, 세션에 `playerFacing: 'down'`, `followerFacings: Array(followers.length).fill('down')`을 추가해 v2를 반환한다.
  3. 유효한 v1 변환 결과를 v2 키에 쓴 후 성공했을 때에만 v1 키를 지운다. 저장소가 비활성화·가득 참으로 쓰기에 실패해도 변환된 데이터를 메모리에서 반환하고 v1을 남긴다. 두 버전이 모두 무효면 `createEmptySave()`를 반환한다.
  4. `saveSave`는 v2 검증을 통과한 값만 v2 키에 기록한다. `clearSave`는 v1·v2 키를 모두 지운다. `mergeSaveData`는 기존 v2 `SaveData` 계약과 기록 병합 동작을 유지한다.
  5. 기존 `saveStore.test.ts`의 임의 `followers` 추가 픽스처에는 같은 길이의 `followerFacings`를 함께 넣는다. 기존 'old-version' 무효 샘플은 이제 `version: 3`으로 바꾼다.
- **Error & Exception Handling**: JSON 파싱 오류, 잘못된 미로 구조, 불일치한 방향 배열, 모르는 버전은 현재처럼 안전하게 빈 저장으로 처리한다. v2 키가 손상돼도 유효한 v1 키가 남아 있으면 그것으로 복구한다.

## Acceptance Criteria
- [x] 벽을 향한 입력은 시선만 바꾸고 이동 횟수·위치·팔로워를 보존한다.
- [x] 팔로워별 방향이 실제 이전 위치와 다음 위치를 따르고, 새 합류·정지 시 기본/이전 방향이 안정적이다.
- [x] 유효한 v1 저장이 v2로 이행되어 단계 기록·현재 미로·구조 상태·타이머가 유지된다.
- [x] v2의 무효 방향 또는 잘못된 배열 길이는 거부되고 v1/v2 저장 삭제가 모두 동작한다.

## Validation
- `npm test -- --run src/game/gameState.test.ts src/persistence/saveStore.test.ts` — 막힌 이동, 다중 팔로워 경로, 새 구조, 재도전 및 v1 이행이 통과.
- `npm run build` — TypeScript의 새 필수 상태 필드와 저장 타입이 모두 연결되어 빌드 통과.

## Commit Message
```text
feat(game): 방향 상태와 기존 저장 데이터 이행 추가

Plan: 2026-09-29-character-and-maze-visual-variety
Phase: P01-visual-variety
Task: T04-facing-state-and-save-migration

- 막힌 이동 시 플레이어 시선과 팔로워별 실제 이동 방향 저장
- v1 저장의 진행도와 현재 미로를 v2로 이행
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `12332b3`
