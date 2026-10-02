# Task: T01 키보드 코너 회전

## Status: done

## Goal

키보드로 진행 방향을 누른 채 직각 방향을 누르면 현재 칸 또는 한 칸 앞의 열린 입구에서 새 방향으로 회전한다. 두 방향키의 독립 타이머가 서로 다른 이동을 중복 실행하는 현상을 없애고 현재 110ms 반복 속도를 유지한다.

## Decision Summary

- 키를 처음 누를 때의 즉시 이동, 이후 110ms마다 시각 격자 한 칸 이동, `gameReducer`의 벽 충돌 판정과 120ms 화면 전환은 그대로다.
- 회전 예약은 새 방향이 현재 막혀 있지만 기존 진행 방향으로 **정확히 한 칸** 이동한 위치에서는 열린 경우에만 만든다. 새 키 해제·포커스 상실·이동 비활성화 시 취소한다. 저장 모델에는 예약을 넣지 않는다.

## Implementation

### I01. 키보드 입력 스케줄러와 한 칸 회전 예약

- Related Files:
  - `src/hooks/useKeyboardMovement.ts` :: `KeyboardMovementOptions`, `useKeyboardMovement`, `keyDirections`, `HOLD_REPEAT_INTERVAL_MS` — 중복 키 조정과 회전 예약; modify
  - `src/game/mazeGrid.ts` :: `isWalkableGridPosition` — 현재·한 칸 앞의 통행 가능 여부; read-only
  - `src/game/types.ts` :: `Direction`, `Position`, `Maze` — 입력과 격자 모델; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface TurnContext { player: Position; maze: Maze }
  interface KeyboardMovementOptions {
    enabled: boolean
    onMove: (direction: Direction) => void
    getTurnContext: () => TurnContext
    onPressedDirectionsChange?: (directions: Direction[]) => void
  }
  interface PendingTurn {
    keyId: string
    direction: Direction
    approachDirection: Direction
    start: Position
    entry: Position
    phase: 'approach' | 'turn'
  }
  export function useKeyboardMovement(options: KeyboardMovementOptions): void
  ```
- **Data & Schema Fields**:
  - `TurnContext.player: Position`은 현재 시각 격자 좌표, `maze: Maze`는 현재 미로다. 둘 다 읽기 전용 입력이며 `GameState`·저장 스키마 필드를 추가하지 않는다.
  - effect 내부의 `heldKeys: Map<string, Direction>`은 `event.code || event.key`별 물리 키를 기록한다. `activeKeyId: string | null`은 실제로 한 틱에 움직일 키, `repeatTimer: number | null`은 **단일** 110ms 타이머, `pendingTurn: PendingTurn | null`은 한 칸 앞 회전 예약이다. 이 값들은 React 상태나 영속 데이터가 아니다.
  - `directionOffsets: Record<Direction, Position>`은 `up(-1,0)`, `right(0,1)`, `down(1,0)`, `left(0,-1)`이다. `start`와 `entry`는 새 방향키를 누른 당시 위치와 기존 방향으로 한 칸 간 위치다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존의 Alt/Ctrl/Meta, 입력 필드·contenteditable, 무관한 키, 운영체제 `event.repeat` 무시와 화살표 기본 동작 방지는 유지한다. `enabled=false`면 리스너·타이머를 설치하지 않는다. 같은 방향의 화살표와 WASD를 함께 누르면 두 물리 키는 기록하되 추가 즉시 이동은 만들지 않는다.
  2. First Key: 첫 유효 키는 기존처럼 `onMove(direction)`을 즉시 한 번 호출하고 단일 `window.setInterval`을 110ms로 시작한다. 매 틱에는 유효한 `activeKeyId`가 가리키는 방향으로 `onMove`를 최대 한 번만 호출한다. 단일 키가 벽에 막혀도 호출을 계속하여 제자리 걷기를 유지한다.
  3. New Direction: 진행 키가 이미 눌린 상태에서 서로 다른 키를 누르면 `getTurnContext()`로 최신 위치·미로를 읽는다. 새 방향이 현재 위치에서 열려 있으면 새 키를 활성화하고 `onMove(newDirection)`을 즉시 호출한다. 즉시 이동 후 반복 타이머의 다음 호출은 110ms 뒤가 되도록 타이머를 재시작한다. 반대 방향도 기존처럼 즉시 활성화한다.
  4. One-cell Reservation: 새 방향이 현재 막힌 **직각 방향**이면 `entry = player + offset(activeDirection)`과 `turnTarget = entry + offset(newDirection)`을 구한다. `entry`와 `turnTarget`이 모두 `isWalkableGridPosition`일 때만 `PendingTurn`을 만든다. 예약 직후에는 막힌 새 방향의 이동 시도를 호출하지 않고 기존 방향의 타이머 주기를 유지한다. 첫 틱에서 아직 `start`에 있으면 기존 방향으로 한 칸 시도하고 `phase='turn'`으로 바꾼다. 다음 틱에서 실제 위치가 `entry`이며 새 방향이 여전히 열려 있고 새 키가 눌려 있으면 새 방향으로 한 번 이동한 뒤 새 키를 활성화하고 예약을 지운다. 중간에 위치가 예상과 달라지거나 기존 방향으로 이동하지 못하면 예약을 지운다. 틱당 `onMove`는 최대 한 번이다.
  5. No Reservation: 새 방향이 막혀 있고 한 칸 앞에서도 열리지 않으면 예약하지 않고 현재 진행 키를 활성 상태로 유지한다. 새 키를 계속 누른 채 멀리 이동해도 나중 입구를 다시 검색하지 않는다. 기존 진행 키를 놓으면 남은 최근 키가 다음 틱부터 활성화된다.
  6. Cancellation: 예약의 새 물리 키를 놓거나 진행 방향키가 모두 해제되면 예약을 지운다. 활성 키를 놓으면 남은 키 중 가장 최근에 눌린 것을 활성화한다. 마지막 키 해제, `window.blur`, effect cleanup, `enabled=false`에서 단일 타이머·모든 키·예약을 정리하고 `onPressedDirectionsChange([])`를 보낸다. 키를 놓는 것만으로 추가 이동을 만들지 않는다.
  7. Pressed Directions: 기존 `onPressedDirectionsChange` 계약은 유지한다. 실제 눌린 물리 키들의 방향을 중복 제거해 전달하므로 `MazeBoard`의 막힌 상태 제자리 걷기 종료 조건이 계속 동작한다.

### I02. GameScreen에서 최신 미로·위치 제공

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, `handleKeyboardMove`, `useKeyboardMovement` 호출 — 안정적인 최신 상태 조회 콜백 연결; modify
  - `src/game/gameState.ts` :: `GameState`, `gameReducer` — 실제 이동·충돌 처리; read-only
  - `src/components/Controls/DirectionControls.tsx` :: `DirectionControls` — 버튼 클릭 경로; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  const latestState = useRef<GameState>(state)
  const getTurnContext = useCallback(
    (): Pick<GameState, 'player' | 'maze'> => ({
      player: latestState.current.player,
      maze: latestState.current.maze,
    }),
    [],
  )
  ```
- **Data & Schema Fields**: 새 React 상태나 저장 필드는 없다. `latestState`는 게임의 이미 존재하는 `player`와 `maze`를 조회하기 위한 ref다.
- **Execution Flow / Logic**:
  1. `useLayoutEffect`로 매 `state` 변경 후 `latestState.current = state`를 갱신한다. 안정적인 `getTurnContext`를 훅에 전달하여 플레이어가 매 칸 이동해도 키 effect·110ms 타이머가 재설치되지 않게 한다.
  2. `handleKeyboardMove`는 기존 `handleMove(direction, 'keyboard')`를 유지한다. 예약 중 실제로 실행한 이동 시도만 `movementAttempt`를 늘린다. `handleButtonMove`와 `DirectionControls`의 클릭 입력은 회전 예약을 거치지 않는다.
  3. `gameReducer`의 `MOVE` 규칙, `MazeBoard` 카메라·애니메이션, `PlayerSprite`의 1.6칸 크기, 타이머·저장 상태는 변경하지 않는다. 일시정지·승패로 `playing=false`가 되면 훅의 cleanup이 예약을 취소한다.

### I03. 행동과 회귀 검증

- Related Files:
  - `src/hooks/useKeyboardMovement.test.ts` :: `describe('useKeyboardMovement')` — 단일 반복 타이머와 예약 분기 검증; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: `describe('GameScreen')` — 실제 게임 상태와 방향 버튼 회귀 검증; modify

#### Details

- **Signatures & Types**: 기존 `renderHook` 호출마다 `getTurnContext`를 제공한다. 가까운 입구 테스트용 `Maze`는 2×2 논리 셀에서 `(0,0).right`/`(0,1).left`와 `(0,1).bottom`/`(1,1).top`만 열고 나머지 벽을 닫는다. 첫 `right` 입력으로 `(1,1)→(1,2)`에 도달하면 현재 `down`은 막혀 있고 `right` 한 칸 뒤 `(1,3)`의 `down`은 열린다. 먼 입구 테스트용 3×3 미로는 첫 행의 오른쪽 통로 두 개와 `(0,2).bottom`만 열어 `(1,3)`에서 목표 입구 `(1,5)`가 두 칸 떨어지게 한다.
- **Data & Schema Fields**: 테스트의 위치 변수는 성공한 `onMove` 때만 `isWalkableGridPosition`을 거쳐 갱신한다. 제품 상태·저장 스키마에는 추가 필드가 없다.
- **Execution Flow / Logic**:
  1. 단일 키의 즉시 한 칸·110ms 반복·짧은 탭·막힌 키 제자리 걷기·운영체제 repeat 무시, 화살표/WASD 매핑과 입력 필드 무시는 기존 테스트로 유지한다.
  2. `(1,1)`에서 첫 `right` 입력으로 `(1,2)`까지 이동한 뒤 `right`를 누른 채 `down`을 누르면 새 방향 keydown은 추가 이동하지 않고, 첫 반복에서 `(1,3)`으로 가며 다음 반복에서 `(2,3)`으로 꺾인다. 각 반복 틱당 이동 시도 한 번만 발생한다. 현재 위치에서 새 방향이 열려 있으면 즉시 회전한다.
  3. 먼 입구 미로에서 `(1,2)`에서 첫 `right` 입력으로 `(1,3)`에 도달했을 때처럼 입구가 두 칸 앞이면 새 방향을 미리 눌러도 회전 예약을 하지 않는다. 새 키 해제, 기존 진행 키 해제, blur, `enabled=false`에서 대기 중 회전이 사라진다. 같은 방향 두 물리 키는 속도를 두 배로 만들지 않고, 반대 방향 입력은 즉시 전환한다.
  4. `GameScreen` 테스트에서는 결정적 미로의 통행 가능한 `start`, `entry`, `turnTarget`을 찾아 `initialState.player=start`, `status='playing'`으로 렌더한다. `[data-asset-slot="player"]`의 `data-grid-row`/`data-grid-col`로 실제 한 칸 전진과 회전, 키 해제 후 정지, 버튼 클릭이 한 번 이동하는지 확인한다. 기존 시작 카운트다운·일시정지·제자리 걷기 테스트도 통과해야 한다.

## Acceptance Criteria

- [x] 두 키가 눌려도 한 반복 틱에 이동 시도는 최대 한 번이며 110ms 반복 주기가 유지된다.
- [x] 현재 열린 길은 즉시 회전하고, 현재 막혔으나 한 칸 앞에서 열리는 길은 한 칸 진행 후 회전한다. 더 먼 길로는 예약하지 않는다.
- [x] 키 해제·포커스 상실·비활성화에서 회전 예약과 반복 타이머가 정리된다.
- [x] 단일 키 제자리 걷기, 버튼 한 번 이동, 게임 충돌·카메라·저장 동작이 유지된다.

## Validation

- `npm.cmd test -- --run src/hooks/useKeyboardMovement.test.ts src/components/GameScreen/GameScreen.test.tsx` — 새 회전 분기와 기존 입력 동작 통과.
- `npm.cmd test -- --run` — 전체 게임 회귀 통과.
- `npm.cmd run build` — 타입 검사와 번들 통과.

## Commit Message

```text
feat(game): 좁은 길 한 칸 앞 회전 예약 추가

Plan: 2026-10-02-corner-turn-and-walk-frame-size
Phase: P01-turn-and-sprite-stability
Task: T01-keyboard-corner-turn

- 두 방향키의 이동 반복을 한 타이머로 조정
- 한 칸 앞 입구 회전과 키 해제 취소를 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (지정 테스트 31개, 전체 테스트 133개, 빌드)
- commit: Git 기록 참조
