# Task: T01 구출 동물 레이어와 동행 위치 정렬

## Status: done

## Goal
구출 동물 이미지를 장애물보다 위에 그리고, 동행 동물의 실제 이동 좌표와 그림 중심을 맞춰 직선과 코너에서 플레이어의 직전 칸을 따라오게 한다.

## Decision Summary
- 첫 동물은 매 성공 이동에서 플레이어의 직전 칸을, 뒤 동물은 앞 동물의 직전 칸을 차지한다. 기존 `moveFollowers`와 `gameReducer`는 변경하지 않는다.
- 장애물 `z-index: 7`, 동물 `8`, 플레이어 `9` 순서로 표시한다.
- 동물 상자의 크기 `1.4 * cellSize`, 중심 `(col + 0.5, row + 0.5)`를 유지하고 동행 동물의 보간은 `120ms linear`로 한다.
- 상태 모델·저장 스키마·API 변경은 없다. 좌표 `Position`은 기존 정수 `row`, `col`을 사용한다.

## Implementation

### I01. 구출 동물 그림을 이동 칸 중심에 배치
- Related Files:
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite`; modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 기존 동행 위치 기대값; modify

#### Details
- `spriteLeft`와 `spriteTop`의 계산을 플레이어와 같은 `Math.round((position.col - 0.2) * cellSize * 100) / 100`, `Math.round((position.row - 0.2) * cellSize * 100) / 100`으로 변경한다.
- 대기 중인 구조 대상과 구출 후 동행 동물 모두 같은 칸 중심을 사용한다. 인라인 `top`, `left`와 `transform: 'none'`은 유지한다.
- 보드 테스트의 열린 통로 동물 `top`/`left` 기대값을 새 공식으로 변경하고, 구출 대상도 자기 격자 칸 중앙에 놓이는지 확인한다.

### I02. 동물 레이어와 동행 보간
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.rescueSprite`, `.followerSprite`, `.playerSprite`; modify

#### Details
- `.rescueSprite`와 `.followerSprite`의 `z-index`를 `6`에서 `8`로 변경한다. `.playerSprite`의 `z-index`를 `8`에서 `9`로 변경한다. `.obstacleTile`의 `z-index: 7`은 유지한다.
- `.followerSprite`에 `transition: top 120ms linear, left 120ms linear`를 추가해 플레이어의 120ms 위치 전환과 동행 동물의 전환을 맞춘다.
- `prefers-reduced-motion`의 `.sprite { transition: none; }` 규칙은 그대로 적용되게 한다. 기존 동물 점프 애니메이션, 크기와 PNG 투명도는 유지한다.

### I03. 코너 경로 확인
- Related Files:
  - `src/game/gameState.test.ts` :: 기존 `requires rescue before escape and moves followers along previous positions` 테스트; modify

#### Details
- 기존 구출 뒤 경로 테스트에서 이동 방향이 실제로 바뀌는 코너가 있었는지 세고, 코너 이후에도 `state.followers[0]`이 `previous` 플레이어 칸과 같은지 기존 반복 단언과 함께 확인한다.
- 무작위 미로는 기존 고정 시드 `42`를 유지한다. 경로에 코너가 적어도 한 번 존재함을 단언해 코너 요구가 빠지지 않게 한다.
- 실제 `gameReducer`, `moveFollowers`, 벽 충돌 판정은 변경하지 않는다.

## Acceptance Criteria
- [x] 대기 중인 구출 대상과 동행 동물이 장애물 이미지에 가려지지 않는다.
- [x] 플레이어 그림은 동행 동물보다 위에 보인다.
- [x] 동물 상자 중심이 자기 확장 격자 칸의 중심과 일치한다.
- [x] 코너를 돈 직후 첫 동물은 플레이어가 떠난 칸에 있고 뒤 동물은 앞 동물이 떠난 칸에 있다.
- [x] 동행 동물의 화면 이동이 플레이어와 같은 시간으로 보간된다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/game/gameState.test.ts` — 화면 좌표와 코너 경로 테스트 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 구출 동물 레이어와 동행 위치 정렬

Plan: 2026-10-01-rescue-follower-alignment
Phase: P01-follower-rendering
Task: T01-rescue-sprite-layer-and-follower-position

- 구출 동물 이미지를 장애물 위에 표시
- 동행 동물을 이동 칸 중심과 코너 경로에 정렬
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
