# Task: T01 확장 이동 좌표와 게임 상태 및 저장 v4

## Status: done

## Goal
런타임 캐릭터 좌표를 기존 N×N 논리 미로가 아니라 2N+1 렌더 격자에 저장해 한 번의 MOVE가 렌더 칸 하나만 이동하도록 한다. 이동 가능 칸은 원본 미로의 열린 연결과 바닥 중심만 허용하고, 변경된 런타임 좌표를 저장 v4로 검증·복원한다.

## Decision Summary
- 원본 `Maze` 및 스테이지 크기는 N×N으로 유지한다. 모든 런타임 위치는 0..2N 범위의 렌더 격자 좌표이며 바닥 중심은 홀수/홀수다.
- 바닥 중심과 벽 없는 연결만 이동 가능하다. 벽 연결, 짝수/짝수 교차점, 외곽은 막힌다. v3 저장은 마이그레이션하지 않는다.

## Implementation

### I01. 확장 격자 좌표 및 벽 기반 이동 가능성

- Related Files:
  - `src/game/types.ts` :: `Position`, `Maze`, `CellWalls` — 기존 모델을 재사용; read-only
  - `src/game/mazeGrid.ts` :: `expandedGridSize`, `logicalToGridPosition`, `gridToLogicalPosition`, `isWalkableGridPosition` — 확장 좌표 규칙과 통로 판정; new
  - `src/game/mazeGrid.test.ts` :: 좌표 변환 및 이동 가능성; new

#### Details
- **Signatures & Types**:
  ```ts
  export function expandedGridSize(size: number): number
  export function logicalToGridPosition(position: Position): Position
  export function gridToLogicalPosition(position: Position): Position | null
  export function isWalkableGridPosition(maze: Maze, position: Position): boolean
  ```
- **Execution Flow / Logic**:
  1. `expandedGridSize(N)`는 `2 * N + 1`을 반환한다. 유효한 Maze 크기는 기존 규칙에 따라 홀수이며 이 함수에서 topology를 변경하지 않는다.
  2. `logicalToGridPosition({row, col})`는 `{row: 2*row+1, col: 2*col+1}`을 반환한다. `gridToLogicalPosition`은 두 좌표 모두 홀수이고 변환 결과가 Maze 셀 범위 안일 때만 `{row: (row-1)/2, col: (col-1)/2}`를 반환한다. 나머지는 null이다.
  3. `isWalkableGridPosition`은 정수 좌표와 `0 <= row,col < 2*N+1`을 먼저 확인한다. 홀수/홀수는 대응 셀 중심이므로 허용한다. 홀수/짝수는 좌우 셀 사이 연결이며 왼쪽 셀의 `walls.right`가 false일 때 허용한다. 짝수/홀수는 상하 셀 사이 연결이며 위쪽 셀의 `walls.bottom`이 false일 때 허용한다. 짝수/짝수는 항상 false다.
  4. 경계 연결 칸은 이웃 논리 셀이 없는 경우 false다. 홀수/홀수 중심의 유효성은 `Maze`가 이미 N×N이라는 타입 전제를 따른다.
- **Tests**: N=3 같은 작은 Maze fixture로 중심/연결/교차 좌표, 좌우/상하 열린 통로, 닫힌 벽, 바깥 좌표, 음수/소수 좌표를 검증한다. 셀 벽 데이터는 양방향 대칭으로 구성한다.

### I02. GameState 이동, 목표 위치 및 follower 갱신

- Related Files:
  - `src/game/gameState.ts` :: `GameState`, `createGameState`, `gameReducer`, `MOVE` — 런타임 좌표와 한 칸 이동; modify
  - `src/game/entityPlacement.ts` :: `PlacedEntities`, `placeEntities`, `moveFollowers` — 기존 논리 좌표의 목표 배치를 유지하고 좌표 의미를 문서화; modify only if conversion is placed here
  - `src/game/gameState.test.ts` :: reducer 동작 회귀 검증; modify
  - `src/game/integration.test.tsx` :: 게임 진행 경로의 좌표 갱신; modify
- **Data & Schema Fields**:
  - `GameState.player: Position`, `exit: Position`, `followers: Position[]`, `rescues: Array<EntityPosition & { rescued: boolean }>` 모두 렌더 격자 좌표를 가진다. 공개 타입 이름 및 필드는 바꾸지 않는다.
  - `Maze.cells`, `Maze.size`, `StageConfig.size`는 기존 논리 격자 형식을 유지한다. `moveCount` 및 새 이동 횟수 필드는 만들지 않는다.
- **Execution Flow / Logic**:
  1. `createGameState(stage, maze?)`는 기존 `placeEntities` 결과(논리 좌표)를 `logicalToGridPosition`으로 변환해 exit/rescues에 넣는다. 시작 플레이어는 `{row: 1, col: 1}`이다. followers는 빈 배열이다.
  2. `gameReducer`의 `MOVE`는 playing 상태일 때만 요청 방향 오프셋 ±1을 더한 후보를 만든다. `isWalkableGridPosition(state.maze, candidate)`가 false면 player/targets/followers/status를 그대로 보존한다. `playerFacing`이 이미 같으면 state 참조를 그대로 반환할 수 있으며, 방향이 다르면 바라보는 방향만 갱신한다. `movementAttempt`는 UI의 기존 카운터이므로 GameState에 추가하지 않는다.
  3. 유효 이동은 후보 좌표로 구조 대상을 판정하고, 구조된 개체가 있으면 기존 `moveFollowers` 규칙으로 각 follower를 플레이어의 직전 좌표 방향으로 한 렌더 칸 이동시킨다. 새로 구조한 동물은 이동 전 tail 또는 이동 전 player 위치에 추가한다. 새 동물은 현재 플레이어 위치에 순간이동하지 않는다.
  4. 승리 판정은 새 player 좌표와 확장 격자 exit 좌표가 같고 모든 rescue가 구조된 경우에만 참이다. 중간 연결 칸에서 멈춘 상태도 정상 상태다.
- **Tests**: 중심에서 열린 연결로 한 번 이동하면 좌표 변화량의 맨해튼 거리가 1이며, 두 번째 입력으로 다음 중심에 도달한다. 막힌 벽에서 좌표/목표/동물 상태는 그대로고 방향은 요청대로 갱신된다. 구조 목표와 exit는 홀수/홀수이며 rescue 후 follower가 직전 player 위치로 이동한다. MOVE 반복에서 `moveCount`가 생성되지 않는다.

### I03. Save v4 스키마 및 저장소

- Related Files:
  - `src/persistence/saveSchema.ts` :: `SAVE_VERSION`, `SAVE_KEY`, `isPosition`, `isSavedSession`, `isSaveData` — 확장 좌표 스키마 검증; modify
  - `src/persistence/saveStore.ts` :: `loadSave`, `saveSave`, `clearSave` — v4만 로드하고 구버전 키 제거; modify
  - `src/persistence/saveSchema.test.ts` :: 스키마 경계 검증; modify
  - `src/persistence/saveStore.test.ts` :: 로드/삭제/저장소 동작; modify
- **Data & Schema Fields**:
  - `SAVE_VERSION`은 literal `4`, `SAVE_KEY`는 `'maze-rescue-game.save.v4'`다. `SaveData`의 나머지 필드 및 `stageRecords: Record<number, StageRecord>`는 유지한다.
  - SavedSession의 `GameState` 위치는 모두 확장 좌표다. StageRecord에는 `bestTimeSeconds`만 유지한다.
- **Execution Flow / Logic**:
  1. `isPosition(value, size)`의 논리 크기 검사를 저장 검증용으로 재사용하지 않는다. 새 검증은 `isWalkableGridPosition(maze, position)` 기반으로 게임 중 player/follower 좌표가 실제 통로인지 확인한다.
  2. exit와 각 rescue는 `gridToLogicalPosition`이 null이 아닌 좌표여야 하며, 대응 maze cell에서 벽 없는 중심 위치여야 한다. 기존 중복 id/좌표, rescue 수, follower 수, 방향, 시간, stage 검사는 유지한다.
  3. 버전 필드가 4가 아닌 데이터는 `isSaveData`에서 거부한다. `loadSave`는 v4 키만 읽고 v3 키를 fallback으로 사용하지 않는다.
  4. `clearSave`는 `maze-rescue-game.save.v4`, `.v3`, `.v2`, `.v1` 키를 제거한다. 스토리지 예외는 기존처럼 삼켜 게임을 중단하지 않는다.
  5. `moveCount`와 `bestMoveCount`는 허용하지 않는다. 최고 기록은 스테이지별 `bestTimeSeconds`뿐이다.
- **Tests**: v4 유효한 중심/통로 세션 허용, wall/교차/범위 밖 좌표 거부, exit/rescue 연결 칸 거부, v3 버전과 데이터 미복원, v4 key만 로드, clear 시 v4~v1 삭제, time-only 기록 및 moveCount/bestMoveCount 거부.

## Acceptance Criteria
- [x] 각 MOVE는 성공 시 확장 격자 좌표 한 칸만 이동하며, 벽·교차점·경계에서는 위치가 바뀌지 않는다.
- [x] 출구/구조 목표는 논리 바닥 중심에 있고 follower는 각 유효 이동에서 이전 좌표를 따른다.
- [x] 세이브는 v4 확장 좌표만 저장/복구하며 v3는 마이그레이션하지 않는다.
- [x] 완료 시간 기록만 보존되고 moveCount 필드가 없다.

## Validation
- `npm.cmd test -- --run src/game/mazeGrid.test.ts src/game/gameState.test.ts src/game/integration.test.tsx src/persistence/saveSchema.test.ts src/persistence/saveStore.test.ts` — 확장 격자 규칙, reducer와 저장 검증 통과
- `npm.cmd run lint` — 타입 및 lint 오류 없음

## Commit Message
```text
feat(movement): expand game state to one-render-cell steps

Plan: 2026-09-30-one-render-cell-per-move
Phase: P01-render-cell-movement
Task: T01-expanded-grid-game-state-and-save-v4

- Add expanded-grid walkability based on maze walls
- Move actors and followers one rendered cell per input
- Store expanded positions in save v4 without v3 migration
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

