# Task: T01 키 반복과 이동 애니메이션 주기 정렬

## Status: done

## Goal
키를 누른 직후부터 110ms 간격으로 한 칸씩 이동하고, 120ms 선형 위치 보간으로 연속 이동이 일정한 속도로 보이게 한다. 키를 놓거나 입력이 비활성화되면 반복을 멈춘다.

## Decision Summary
- 기존 렌더 격자와 `gameReducer`의 이동·충돌 로직은 유지한다.
- 키보드의 운영체제 반복 이벤트 대신 자체 `setInterval`로 110ms 간격을 제어한다.
- 플레이어·카메라는 120ms 선형 보간, 걷기 프레임은 55ms/110ms에 맞춘다.
- 모델, 저장 스키마, API 필드는 변경하지 않는다. `Direction` 타입은 기존 `'up' | 'right' | 'down' | 'left'`를 그대로 사용한다.

## Implementation

### I01. 키보드 유지 타이머
- Related Files:
  - `src/hooks/useKeyboardMovement.ts` :: `useKeyboardMovement`; modify
  - `src/hooks/useKeyboardMovement.test.ts` :: `useKeyboardMovement` tests; modify

#### Details
- 기존 `INITIAL_REPEAT_DELAY_MS = 500`, `MIN_REPEAT_INTERVAL_MS = 160`, `event.timeStamp` 기반 제한을 제거한다.
- `HOLD_REPEAT_INTERVAL_MS = 110`을 사용한다.
- 효과 내부 `Map<string, number>`는 `event.code || event.key`별 활성 interval ID를 보관한다.
- 첫 `keydown`에서 기존 수정키·입력 필드·방향키 필터와 방향키 `preventDefault()`를 적용한 뒤, 같은 키가 이미 활성 상태이거나 `event.repeat`이면 추가 이동 없이 반환한다. 처음 누른 키에는 `onMove(direction)`을 즉시 1회 호출하고 `window.setInterval(() => onMove(direction), 110)`을 등록한다.
- `keyup`은 해당 키 interval을 `clearInterval`하고 Map에서 삭제한다. `blur`, `enabled === false`가 되는 효과 정리, unmount는 모든 interval을 정리한다.
- 예외 처리: 알 수 없는 키, Alt/Ctrl/Meta 조합, 입력 요소에서는 이동과 타이머를 만들지 않는다. 운영체제 반복 이벤트는 간격을 바꾸지 않는다.
- 테스트는 Vitest 가상 시간을 사용해 즉시 1회, 109ms까지 추가 이동 없음, 110ms에 반복, `event.repeat` 중복 무시, 키 해제·blur·disable 후 반복 없음, 재입력 시 재시작을 검증한다.

### I02. 보간과 걷기 프레임 시간
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.board`, `.playerSprite`, `.playerSprite[data-motion='walk']`; modify
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite` 걷기 프레임 effect; modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: existing walk-frame timer assertions; modify

#### Details
- `.board`의 `transform` 전환과 `.playerSprite`의 `translate` 전환을 `120ms linear`로 변경한다.
- `.playerSprite[data-motion='walk']`의 `walkLift` 애니메이션 시간을 `110ms`로 변경한다.
- `PlayerSprite`의 두 번째 걷기 프레임 타이머를 80ms에서 55ms로, 중지 타이머를 160ms에서 110ms로 변경한다.
- 기존 보드 테스트의 걷기 프레임 시점 기대값을 55ms/110ms에 맞춘다.
- `prefers-reduced-motion` 처리와 기존 방향별 이미지, 스프라이트 위치·크기, 시각적 레이어는 유지한다.

## Acceptance Criteria
- [x] 첫 키 입력에서 즉시 한 칸, 누른 뒤 110ms마다 한 칸 이동한다.
- [x] 짧은 탭과 키 해제 뒤에는 추가 이동이 없다.
- [x] 운영체제 반복 이벤트와 자체 타이머가 중복 이동을 만들지 않는다.
- [x] 게임 중 이동 비활성화와 창 포커스 상실에서 타이머가 정리된다.
- [x] 플레이어·카메라가 연속 이동 중 선형으로 보간되고 방향별 걷기 프레임이 계속 보인다.
- [x] 기존 격자 충돌 및 모바일 버튼의 클릭 동작은 유지된다.

## Validation
- `npm.cmd test -- --run src/hooks/useKeyboardMovement.test.ts` — 키 반복과 중단 테스트 통과.
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 걷기 프레임 테스트 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 키 반복 간격과 이동 애니메이션 개선

Plan: 2026-10-01-smooth-keyboard-movement
Phase: P01-input-and-animation
Task: T01-key-repeat-and-motion-cadence

- 키 유지 중 일정 간격으로 반복 이동
- 플레이어와 카메라의 이동 시간 정렬
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
