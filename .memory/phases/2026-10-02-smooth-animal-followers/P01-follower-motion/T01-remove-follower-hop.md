# Task: T01 따라오는 동물의 점프 제거

## Status: done

## Goal

구출한 동물이 한 칸 이동할 때 수직으로 튀고 찌그러지는 효과를 삭제한다. 위치는 기존 `top`/`left` 120ms 전환으로 부드럽게 바뀌고 방향 이미지와 동물 순서는 유지한다.

## Decision Summary

- 동물 전용 점프는 제거한다. 플레이어의 걸음 연출과 탈출구 별빛은 범위 밖이다.
- `RescueSprite`는 위치와 방향만 렌더링한다. 동물별 애니메이션 상태·타이머는 필요 없다.

## Implementation

### I01. 이동 판정과 점프 상태 제거

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MotionSnapshot`, `MotionState`, `MazeBoard`의 `followerMoved` 계산과 `RescueSprite`의 `movementAttempt`·`animateMove` 전달 삭제; modify
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSpriteProps`, `RescueSprite`의 `hopping` 상태, `useEffect`, 220ms 타이머, `data-motion`, `.hopping` class, 동물 시각 요소의 movement key 삭제; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.hopping`과 `@keyframes animalHop` 삭제. `.followerSprite`의 `transition: top 120ms linear, left 120ms linear` 유지; modify

#### Details

- **Signatures & Types**: `RescueSpriteProps`에는 `animalId: string`, `position: Position`, `cellSize: number`, `facing?: Direction`, `following?: boolean`, `order?: number`만 남긴다. `MotionSnapshot`에는 `movementAttempt`, `seed`, `player`, `playerFacing`만, `MotionState`에는 `movementAttempt`, `playerFacing`, `playerMoved`만 남긴다.
- **Data & Schema Fields**: 저장 데이터와 `GameState.followers: Position[]`, `GameState.followerFacings: Direction[]`는 변경하지 않는다. DOM 동물 요소에서 점프를 뜻하는 `data-motion` 속성은 제거한다.
- **Execution Flow / Logic**:
  1. `MazeBoard`는 플레이어 애니메이션 판정을 기존대로 유지하고 동물 이동 여부 배열만 계산하지 않는다.
  2. `RescueSprite`는 따라오는 동물의 `top`/`left`, `data-grid-row`/`data-grid-col`, 방향별 `src`를 업데이트한다. 시각 요소는 움직임 횟수마다 다시 만들지 않는다.
  3. CSS의 위치 전환은 유지하고 수직 점프와 착지 변형만 없앤다. reduced-motion 규칙은 기존처럼 위치 전환을 해제한다.
- **Error & Exception Handling**: 구출 전 동물과 새로 생긴 동료의 이미지 실패 fallback과 철장은 유지한다. `following`이 false여도 효과가 생기지 않는다.
- **State Transition & Return**: reducer의 동물 순서와 이동 로직은 변경하지 않는다.

### I02. 이동 회귀 검증

- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 점프 검증 테스트를 동물 위치·방향·동일 요소 유지 및 새 동료 표시 검증으로 수정; modify

#### Details

- 기존 `hops only existing followers that changed cells` 테스트를 바꾼다. 초기 동물 요소를 잡고 다음 위치로 rerender한 뒤 같은 DOM 요소, 갱신된 `top`/`left`와 `data-grid-row`/`data-grid-col`, `data-facing` 및 방향별 이미지를 확인한다. 새 동료의 렌더링과 모든 동물의 점프 속성 부재를 확인한다.
- `src/components/GameScreen/GameScreen.test.tsx`, `src/game/gameState.test.ts`는 기존 회귀 범위로 검증한다.

## Acceptance Criteria

- [x] 구출한 동물에 수직 점프 애니메이션이 없다.
- [x] 따라오는 동물의 위치 전환과 방향 이미지, 순서는 유지된다.
- [x] 플레이어 애니메이션과 구출 전 동물의 철장은 유지된다.
- [x] 관련 테스트, 전체 테스트, 빌드가 통과한다.

## Validation

- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 렌더링과 이동 회귀.
- `npm.cmd test -- --run` — 전체 테스트.
- `npm.cmd run build` — 타입과 번들.
- `git diff --check` — 공백 오류 없음.

## Commit Message

```text
style(game): 따라오는 동물 점프 효과 제거

Plan: 2026-10-02-smooth-animal-followers
Phase: P01-follower-motion
Task: T01-remove-follower-hop

- 동물의 점프 상태와 CSS 애니메이션 삭제
- 부드러운 위치 이동과 방향 표시 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
