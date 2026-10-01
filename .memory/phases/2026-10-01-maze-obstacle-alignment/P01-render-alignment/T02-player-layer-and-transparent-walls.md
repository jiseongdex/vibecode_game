# Task: T02 플레이어 표시 순서와 장애물 투명도

## Status: done

## Goal
플레이어 그림을 장애물 이미지보다 위에 표시하고, 장애물 PNG의 투명 부분에 보드 바닥이 비치게 한다.

## Decision Summary
- `.memory/decisions/2026-10-01-maze-obstacle-alignment.md`의 D03을 적용한다.
- 기존 확장 격자 좌표·충돌·카메라·벽 칸 배치·이미지 크기는 유지한다.
- CSS만 수정한다. 게임 상태 모델 및 스키마 변경은 없다.

## Implementation

### I01. 플레이어의 쌓임 순서를 벽보다 높게 설정
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.playerSprite`, `.obstacleTile`; modify `.playerSprite` only
- Details:
  - `.obstacleTile`은 `z-index: 7`, `.playerSprite`는 현재 `z-index: 6`이다.
  - `.playerSprite`의 `z-index`를 `8`로 변경한다. 플레이어가 벽 이미지 영역과 겹쳐도 플레이어가 위에 보이게 한다.
  - `.sprite`, `.rescueSprite`, `.followerSprite`, `.wallBlock`의 크기 및 이동 규칙은 바꾸지 않는다.

### I02. 장애물 PNG의 알파 영역 복원
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.obstacleTile`; modify
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`; read-only
- Details:
  - `.obstacleTile`의 `background: var(--wall-color)` 선언을 제거한다. 배경 기본값은 투명이어야 한다.
  - `.wallBlock`은 기존 `185%` 크기와 투명 PNG 원본, `object-fit: contain`을 유지한다.
  - 이미지 로드 실패 시에만 `.wallFallback`이 `--wall-color`를 사용하도록 기존 선택자 `.wallBlock[hidden] + .wallFallback`을 유지한다.
  - 벽 타일의 `overflow: hidden`과 `pointer-events: none`을 유지한다.

## Acceptance Criteria
- [x] 플레이어와 장애물 이미지가 겹치는 곳에서 플레이어가 위에 보인다.
- [x] 벽 PNG의 투명 영역에서 불투명 테마색 사각형이 나타나지 않는다.
- [x] 이미지 로드 실패 fallback은 기존처럼 보인다.
- [x] 이동 판정과 벽 칸 배치는 변경되지 않는다.

## Validation
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드가 통과해야 한다.

## Commit Message
```text
fix(maze): 플레이어 표시 순서와 장애물 투명도 수정

Plan: 2026-10-01-maze-obstacle-alignment
Phase: P01-render-alignment
Task: T02-player-layer-and-transparent-walls

- 플레이어를 장애물 이미지보다 위에 표시
- 장애물 타일 배경색을 제거해 PNG 투명도 복원
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
