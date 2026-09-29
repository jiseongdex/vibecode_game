# Task: T04 미로 보드와 캐릭터 중심 카메라

## Status: done

## Goal
게임 상태를 시각적인 2D 탑다운 미로로 렌더링하고, 33×33 보드에서도 플레이어 주변이 중심에 오도록 표시한다.

## Decision Summary
- 미니맵 없이 캐릭터 중심 카메라를 사용한다.
- 밝고 친근한 판타지 스타일은 후속 에셋 Task에서 적용하되, 보드 렌더러는 교체 가능한 로컬 이미지 슬롯을 제공한다.

## Implementation

### I01. 보드 컴포넌트
- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`; new
  - `src/components/MazeBoard/MazeBoard.module.css` :: 보드/셀 스타일; new
  - `src/components/MazeBoard/MazeCell.tsx` :: `MazeCell`; new
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite`; new
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite`; new
  - `src/components/Exit/ExitSprite.tsx` :: `ExitSprite`; new

#### Details
- `MazeBoard` props는 `{ state: GameState; onMove: (direction: Direction) => void }`다.
- 각 셀은 CSS grid의 동일한 정사각형이며 `data-row`, `data-col`, `data-cell-type`를 제공한다.
- 벽은 `Cell.walls`를 CSS 변수/클래스로 반영하고, 플레이어·구출 대상·follower·탈출구 레이어는 셀 내부에 렌더링한다.
- `MazeBoard`는 플레이어 위치를 기준으로 `transform: translate` 또는 scroll positioning을 사용해 카메라를 중앙화한다. 보드 가장자리에서는 컨테이너 밖으로 빈 공간이 생기지 않도록 clamp한다.
- 보드 전체를 축소해 보여주는 미니맵은 렌더링하지 않는다.

### I02. 렌더링 테스트
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 보드 렌더링 테스트; new

#### Details
- 초기 상태에서 셀 수와 플레이어·탈출구가 렌더링되는지 검증한다.
- 구조 전/후 대상과 followers가 구분되는지 검증한다.
- 셀의 벽 데이터가 CSS 클래스에 반영되는지 검증한다.

## Acceptance Criteria
- [x] 실제 `GameState`로 15×15와 33×33 보드를 렌더링할 수 있다.
- [x] 플레이어가 이동하면 카메라 중심 위치가 함께 변경된다.
- [x] 미니맵 없이 벽·플레이어·구출 대상·탈출구·followers가 식별된다.
- [x] `prefers-reduced-motion`에서 카메라/캐릭터 애니메이션이 줄어든다.

## Validation
- `npm test -- --run src/components/MazeBoard/MazeBoard.test.tsx`
- `npm run build`

## Commit Message
```text
feat(ui) : 플레이어 중심 미로 보드 렌더링

계획: 2026-09-29-maze-rescue-game
단계: P02-gameplay-ui
작업: T04-maze-board-renderer

- 미로 벽과 플레이어·구출 대상·탈출구 렌더링
- 큰 미로에서도 플레이어를 따라가는 카메라 적용
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
