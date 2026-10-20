# Task: T01 장애물 앞 제자리 걸음 애니메이션

## Status: done

## Goal

이동 가능한 게임에서 플레이어가 막힌 방향을 누르면 좌표를 유지한 채 해당 방향의 걷기 PNG A/B를 재생한다. 누른 방향키를 유지하면 기존 110ms 반복에 따라 계속 걷고, 키 해제·창 포커스 상실·플레이 중단 시 즉시 기본 이미지로 돌아간다. 화면 방향 버튼의 막힌 이동은 110ms 한 번 재생한다.

## Decision Summary

- [장애물 앞 제자리 걸음 결정](../../../decisions/2026-10-01-blocked-in-place-walk.md): 네 방향 모두 막힌 이동에 걷기 이미지를 쓰고, 키 해제 때 정지한다.
- 기존 `useKeyboardMovement`의 110ms 반복과 `PlayerSprite`의 55ms/110ms 프레임, 방향 전환 페이드, 모션 감소 처리는 유지한다.
- 이전 [막힌 플레이어 크기 결정](../../../decisions/2026-10-01-blocked-player-size.md)의 D02 중 '막힌 이동은 기본 이미지만 표시'는 이번 결정으로 대체한다. `<span data-asset-slot="player">`와 `<img>` 노드, `--sprite-size`, `translate`는 그대로 유지한다.

## Implementation

### I01. 키보드에서 현재 눌린 방향을 화면으로 알림

- Related Files:
  - `src/hooks/useKeyboardMovement.ts` :: `KeyboardMovementOptions`, `useKeyboardMovement` — modify
  - `src/hooks/useKeyboardMovement.test.ts` :: `describe('useKeyboardMovement')` — modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface KeyboardMovementOptions {
    enabled: boolean
    onMove: (direction: Direction) => void
    onPressedDirectionsChange?: (directions: Direction[]) => void
  }
  ```
- **Data & Schema Fields**:
  - 키 타이머 맵: `Map<string, { timer: number; direction: Direction }>`; 키 식별자는 기존 `event.code || event.key` 그대로 사용한다.
  - 알림의 `directions`는 현재 눌린 키에 해당하는 중복 없는 `Direction[]`이다. 같은 방향에 두 키가 눌리면 한 방향만 포함한다.
- **Execution Flow / Logic**:
  1. 기존 수정키·텍스트 입력 무시, 화살표 기본 동작 방지, `event.repeat` 무시 조건을 유지한다.
  2. 새 유효 키를 누르면 기존처럼 즉시 `onMove(direction)`를 호출하고 110ms 간격 타이머를 등록한다. 등록 후 현재 방향 집합을 `onPressedDirectionsChange`로 알린다.
  3. `keyup`은 해당 키 타이머를 제거하고 남은 방향 집합을 알린다. 알 수 없는 키나 중복 해제는 상태를 바꾸지 않는다.
  4. `blur`, `enabled=false`, 언마운트는 모든 타이머를 정리하고 빈 배열을 알린다. 콜백이 없는 기존 호출자도 정상 동작한다.
- **Error & Exception Handling**: 잘못된 키·수정키·입력 필드 이벤트는 타이머와 방향 집합을 건드리지 않는다. 콜백 때문에 effect가 매 이동마다 재구독되지 않도록 호출자에서 안정된 콜백을 사용한다.
- **Tests**: 기존 키 매핑·반복 테스트를 유지하고, 2개 키 동시 누름과 같은 방향의 화살표/WASD 중복, 부분 해제, 최종 해제, blur, 비활성화 시 알림과 타이머 정리를 검증한다.

### I02. 입력 출처와 눌린 방향을 보드에 전달

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, `handleMove` — modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: `describe('GameScreen')` — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type MovementSource = 'keyboard' | 'button'
  const [pressedDirections, setPressedDirections] = useState<Direction[]>([])
  const [movementSource, setMovementSource] = useState<MovementSource>('button')
  ```
- **Data & Schema Fields**: `movementAttempt: number`는 기존처럼 매 유효 이동 요청마다 증가한다. `movementSource`와 `pressedDirections`는 화면 전용 React 상태이며 `GameState`와 저장 스키마에는 넣지 않는다.
- **Execution Flow / Logic**:
  1. 공통 이동 함수에서 입력 출처를 기록하고 `movementAttempt`를 증가시킨 뒤 기존 `MOVE` 액션을 dispatch한다.
  2. `useKeyboardMovement`의 `onMove`는 출처 `keyboard`, `DirectionControls.onMove`는 출처 `button`인 안정된 콜백을 연결한다.
  3. 훅의 `onPressedDirectionsChange`를 `setPressedDirections`에 연결하고 두 값을 `MazeBoard`에 전달한다. 키 해제나 blur의 빈 방향 목록이 화면에 반영되어야 한다.
  4. 버튼 한 번 누름은 키 유지 상태와 무관하게 한 번의 걷기 동작으로 취급한다. 플레이 상태가 아닌 동안 기존 조작 비활성화 동작을 유지한다.
- **Error & Exception Handling**: 여러 방향키가 동시에 눌려도 마지막 이동 요청의 출처와 방향을 현재 애니메이션에만 적용한다. `TICK`처럼 이동 시도가 아닌 재렌더는 `movementAttempt`를 증가시키지 않는다.
- **Tests**: 실제 `GameScreen`에서 시작 후 막힌 방향(초기 `(1,1)`에서 `ArrowUp`) 키를 누르고 110ms 이상 유지하면 걷기 이미지가 계속 나타나며 좌표가 고정되는지, 키 해제·blur·일시정지에서 정지하는지, 막힌 방향 버튼은 한 번 재생한 뒤 멈추는지 검증한다.

### I03. 막힌 이동도 걷기 프레임을 요청

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoardProps`, `MotionState`, `MazeBoard` — modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `describe('MazeBoard')` — modify
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite` — read-only; 기존 프레임 타이머와 이미지 선택을 재사용
  - `src/game/gameState.ts` :: `gameReducer` — read-only; 충돌 판정 유지

#### Details

- **Signatures & Types**:
  ```typescript
  interface MazeBoardProps {
    state: GameState
    onMove: (direction: Direction) => void
    appearance?: PlayerAppearance
    movementAttempt?: number
    movementSource?: 'keyboard' | 'button'
    pressedDirections?: readonly Direction[]
  }
  ```
- **Data & Schema Fields**: 기존 `MotionSnapshot`과 `MotionState`의 필드를 유지한다. `playerMoved`는 실제 좌표 변화 여부이고, `movementAttempt`는 좌표 변화 없이도 반복 입력을 식별한다. 새 props의 기본값은 `movementSource='button'`, `pressedDirections=[]`로 두어 기존 보드 호출과 테스트가 단발 시도처럼 동작하게 한다.
- **Execution Flow / Logic**:
  1. 기존 `useLayoutEffect`의 `movementAttempt`·시드 비교로 생성하는 `currentMotion`은 유지한다. 유효한 연속 시도(`last + 1`)에서 좌표가 같아도 `currentMotion`은 존재한다.
  2. `PlayerSprite.animateMove`를 `currentMotion`이 현재 시도·방향에 일치하고, 실제 이동했거나 막힌 시도의 표시 조건을 만족할 때 참으로 만든다. 막힌 시도 표시 조건은 `state.status === 'playing'`이고 (`movementSource === 'button'` 또는 `pressedDirections.includes(state.playerFacing)`)인 경우다.
  3. 키보드 막힌 시도에서 해당 방향 키가 해제되면 `animateMove=false`가 되어 `PlayerSprite`의 기존 effect가 프레임을 `null`로 정리한다. 버튼 시도는 기존 110ms stop 타이머로 끝난다. 정상 이동은 키 해제 후에도 기존 110ms 프레임을 마친다.
  4. 플레이어 위치·크기·DOM 노드, follower의 `animateMove`, 방향 전환 오버레이, 이미지 파일과 사전 로드 코드는 유지한다. 모션 감소 시 `PlayerSprite`가 기존처럼 기본 이미지를 표시한다.
- **Error & Exception Handling**: 시드 변경·시도 번호 건너뛰기는 기존대로 모션을 취소한다. 게임이 paused/won/lost이면 막힌 제자리 걸음은 표시하지 않는다. 같은 방향의 반복 시도에서 새 방향 전환 오버레이를 만들지 않는다.
- **Tests**: 막힌 벽이나 경계를 각 방향으로 찾아 `gameReducer`의 좌표 불변을 확인한 뒤 보드에 `movementAttempt=1,2`를 전달한다. `data-facing`과 방향별 `back/left/front/right-walk-a/b.png`, 55ms 교체, 110ms 종료, 동일 플레이어·이미지 노드와 `--sprite-size`/`translate` 불변을 검증한다. 기존 '막힌 시도는 기본 이미지' 기대 3곳을 새 행동에 맞춰 갱신한다. 성공 이동의 교대 발, 방향 전환 페이드, 모션 감소·동물 점프 회귀 테스트는 유지한다.

## Acceptance Criteria

- [ ] 위·왼쪽·아래·오른쪽 어느 방향으로 막혀도 해당 방향 걷기 이미지 A/B가 반복되고 플레이어 좌표가 고정된다.
- [ ] 키를 놓거나 포커스가 사라지거나 플레이가 중단되면 막힌 제자리 걸음이 멈춘다. 방향 버튼의 단발 시도는 한 주기만 재생한다.
- [ ] 정상 이동 속도·걷기 프레임, 방향 전환, 구출 동물, 모션 감소, 플레이어 표시 상자 크기가 유지된다.
- [ ] 타입 검사, 관련 테스트, 전체 빌드가 통과한다.

## Validation

- `npm test -- --run src/hooks/useKeyboardMovement.test.ts src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 입력·보드·통합 동작 통과
- `npm run lint` — TypeScript 검사 통과
- `npm run build` — 프로덕션 빌드 통과

## Commit Message

```text
feat(maze): 막힌 이동 입력에도 제자리 걸음 재생

Plan: 2026-10-01-blocked-in-place-walk
Phase: P01-blocked-walk
Task: T01-blocked-walk-animation

- 네 방향 막힌 입력에 기존 걷기 프레임 연결
- 키 해제와 플레이 중단 시 제자리 걸음 정리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (관련 테스트 42개, TypeScript 검사, 프로덕션 빌드)
- commit: Git 기록 참조
- `.memory/`는 `.gitignore` 대상이다. 커밋할 때 이 Task 파일이 아직 추적되지 않았다면 `git add -f`로 Task 파일을 명시적으로 스테이징한다.
