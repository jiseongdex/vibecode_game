# 작업: T02 키 반복과 막힌 이동 애니메이션

## 상태: 완료

## 목표
브라우저의 반복 키보드 이벤트마다 한 번씩 이동을 시도하도록 하고, 벽이나 경계에 부딪혀도 플레이어가 해당 방향으로 걷는 애니메이션을 반복한다. 이동 횟수 통계는 만들거나 저장하지 않는다.

## 결정 요약
- 별도의 반복 타이머나 키를 놓은 뒤 실행되는 이동 대기열 없이 브라우저의 반복 `keydown` 이벤트를 사용한다. 최초 입력 뒤 500ms부터 반복 이동을 허용하며, 반복 이동 사이에는 최소 160ms를 둔다.
- `gameReducer`의 기존 벽·경계 충돌 처리를 유지한다.
- 시각 효과용 이동 시도 신호는 저장되는 `GameState`가 아닌 UI 임시 상태로 관리한다. T01에서 `moveCount`는 제거된다.

## 구현

### I01. 반복 keydown 이벤트 받기
- 관련 파일:
  - `src/hooks/useKeyboardMovement.ts` :: `useKeyboardMovement`; 수정
  - `src/hooks/useKeyboardMovement.test.ts` :: `useKeyboardMovement` 테스트; 수정

#### 세부 사항
- **시그니처와 타입**: `useKeyboardMovement({ enabled: boolean, onMove: (direction: Direction) => void }): void`와 기존 `keyDirections` 매핑(`Arrow*`, `WASD`)을 유지한다.
- **실행 흐름과 로직**:
  1. 활성 상태 확인, 수정키 입력 무시, 편집·입력 요소에서의 입력 무시, 화살표 키 기본 동작 방지를 유지한다.
  2. 최초 `keydown`은 즉시 한 번 이동하고, `event.repeat === true` 입력은 최초 누름 후 500ms가 지났고 마지막 이동 후 160ms 이상 지났을 때만 이동한다.
  3. `keyup` 또는 창 `blur`에서 해당 키의 반복 시간을 초기화한다. 타이머, 입력 버퍼, 키를 놓은 뒤 실행되는 이동 대기열을 추가하지 않는다. 기존 window 이벤트 리스너 정리도 유지한다.
- **테스트**: 최초 keydown은 한 번 처리하고 500ms 이전 반복은 무시하며, 반복 간격 160ms부터 처리하는지 확인한다. keyup 뒤 뒤늦은 반복 이벤트가 이동시키지 않는지 확인한다. 다른 키·수정키·입력 요소·리스너 수명주기 테스트는 유지한다.

### I02. 매 입력을 보드에 전달하고 막힌 시도도 애니메이션
- 관련 파일:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, `handleMove`; 수정
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoardProps`, `MazeBoard`, 동작 스냅샷·효과; 수정
  - `src/components/GameScreen/GameScreen.test.tsx` :: 키보드 통합 테스트; 수정
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 막힌 입력 애니메이션 테스트; 수정

#### 세부 사항
- **시그니처와 타입**:
  - `MazeBoardProps`에 `movementAttempt?: number`를 추가한다. 기존 직접 렌더링 테스트 호환을 위해 기본값은 `0`이다.
  - `GameScreen`의 `handleMove(direction: Direction): void`가 호출될 때마다 로컬 숫자형 시도 신호를 1 증가시키고 reducer에 `{ type: 'MOVE', direction }`를 전달한다. 시도 신호를 `MazeBoard`에 전달한다.
  - `MotionSnapshot`에 `movementAttempt: number`를 둔다. `GameState`에 이동 횟수 필드를 추가하지 않는다.
- **실행 흐름과 로직**:
  1. 키보드 반복 이벤트와 방향 버튼 이동 호출마다 시도 신호가 한 번 증가한다.
  2. reducer는 기존대로 칸 이동·충돌·구출·동행 동물 로직만 처리하고 이동 횟수 통계를 계산하지 않는다.
  3. `MazeBoard`가 `movementAttempt` 변경을 감지해 걷기 피드백을 실행한다. 방향과 좌표가 그대로인 연속 막힘 입력에도 매번 다시 실행한다.
  4. 애니메이션 신호는 컴포넌트 렌더링에만 쓰며 세이브, 캠페인 기록, HUD 통계에 기록하지 않는다.
- **테스트**:
  - `GameScreen`에서 반복 keydown 이벤트마다 이동 처리 및 시도 신호가 갱신되는지 확인한다.
  - `MazeBoard`에서 좌표·방향이 유지된 상태로 `movementAttempt`만 증가시켜 걷기 피드백이 다시 실행되는지 확인한다.
  - 막힌 입력이 플레이어 좌표를 바꾸지 않는지 확인한다.

## 완료 기준
- [ ] 짧은 키 입력은 한 칸만 이동하고, 길게 누르면 500ms 뒤부터 160ms 간격으로 반복 이동한다. 다른 키·수정키는 기존대로 무시된다.
- [ ] 반복 입력이 멈춘 뒤 대기 중이던 이동이 실행되지 않는다.
- [ ] 연속된 막힌 입력이 입력 방향 발 애니메이션을 반복하지만 플레이어 위치는 그대로다.
- [ ] 이 작업에서 게임 이동 횟수 통계 필드는 사용하지 않는다.

## 검증
- `npm test -- --run src/hooks/useKeyboardMovement.test.ts src/components/GameScreen/GameScreen.test.tsx src/components/MazeBoard/MazeBoard.test.tsx src/game/gameState.test.ts` — 지정한 테스트 모두 통과
- `npm run lint` — TypeScript 빌드 통과

## 커밋 메시지
```text
feat(movement): 반복 키 입력과 막힌 걷기 애니메이션 지원

Plan: 2026-09-30-smooth-single-cell-movement
Phase: P01-smooth-movement
Task: T02-key-repeat-and-blocked-walk

- 브라우저 키 반복 이벤트마다 이동 시도 처리
- 렌더 전용 신호로 막힌 이동 애니메이션 실행
```

## 진행 상태
- [x] 구현 완료
- [x] 검증 통과
- 커밋: 대기
