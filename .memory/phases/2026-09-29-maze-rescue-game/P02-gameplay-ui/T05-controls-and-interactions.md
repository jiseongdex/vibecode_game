# Task: T05 키보드·터치 조작과 자동 상호작용

## Status: done

## Goal
방향키/WASD와 화면 방향 버튼을 동일한 `MOVE` 액션으로 연결하고, 입력 중복·스크롤·접근성 문제 없이 게임을 조작할 수 있게 한다.

## Decision Summary
- 데스크톱은 방향키와 WASD, 모바일은 화면 방향 버튼을 사용한다.
- 구출 대상과 탈출구는 칸 진입 시 자동으로 상호작용한다.

## Implementation

### I01. 입력 훅과 방향 버튼
- Related Files:
  - `src/hooks/useKeyboardMovement.ts` :: `useKeyboardMovement`; new
  - `src/components/Controls/DirectionControls.tsx` :: `DirectionControls`; new
  - `src/components/Controls/DirectionControls.module.css` :: 방향 버튼 스타일; new

#### Details
- `useKeyboardMovement({ enabled, onMove })`는 ArrowUp/W/S 등을 `Direction`으로 매핑한다.
- `preventDefault`는 게임이 활성 상태이고 방향키일 때만 실행하여 페이지 스크롤을 막는다.
- 입력 이벤트 listener는 effect cleanup에서 제거한다.
- `DirectionControls`는 각 방향에 `aria-label`, `type="button"`, pointer/touch 이벤트를 제공하며 `onMove(direction)`을 한 번만 호출한다.
- `disabled`는 `paused`, `won`, `lost` 상태에서 적용한다.

### I02. 게임 화면 연결
- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`; new
  - `src/components/GameScreen/GameScreen.module.css` :: 게임 화면 레이아웃; new

#### Details
- `GameScreen`은 `useReducer(gameReducer)`를 소유하고 `MazeBoard`와 `DirectionControls`에 같은 move dispatcher를 전달한다.
- 입력은 시작 전 `ready` 상태에서는 무시하거나 시작 동작으로 전환하고, 일시정지/종료 상태에서는 무시한다.
- `useEffect`로 `playing` 중 1초 간격 `TICK`을 dispatch하고 cleanup한다.

### I03. 입력 테스트
- Related Files:
  - `src/hooks/useKeyboardMovement.test.ts` :: 키 매핑/cleanup 테스트; new
  - `src/components/Controls/DirectionControls.test.tsx` :: 버튼 입력 테스트; new

#### Details
- Arrow 및 WASD 8개 입력이 네 방향으로 올바르게 매핑되는지 검증한다.
- 비게임 키는 무시하고, disabled 상태에서 callback을 호출하지 않는지 검증한다.
- 버튼의 `aria-label`과 클릭 1회당 이동 1회 호출을 검증한다.

## Acceptance Criteria
- [x] 키보드와 화면 버튼이 동일한 이동 로직을 사용한다.
- [x] 모바일 터치에서 브라우저 스크롤/중복 이동이 발생하지 않는다.
- [x] 일시정지·승리·실패 중 이동이 불가능하다.
- [x] 제한 시간은 게임이 playing일 때만 감소한다.

## Validation
- `npm test -- --run src/hooks/useKeyboardMovement.test.ts src/components/Controls/DirectionControls.test.tsx`
- `npm run build`

## Commit Message
```text
feat(ui) : 키보드와 터치 미로 조작 연결

계획: 2026-09-29-maze-rescue-game
단계: P02-gameplay-ui
작업: T05-controls-and-interactions

- 키보드와 화면 방향 버튼을 동일한 이동 액션에 연결
- 게임 화면에 제한 시간과 자동 상호작용 연결
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
