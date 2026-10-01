# Task: T01 플레이어 및 장애물 렌더 정렬

## Status: done

## Goal
플레이어를 논리 좌표에 대응하는 확장 격자 칸 중앙에 렌더링하고, 서로 인접한 벽 타일의 PNG 투명 여백으로 생기는 바닥색 틈을 보정한다. 게임 좌표, 충돌 규칙, 벽 위치는 바꾸지 않는다.

## Decision Summary
- 기존 `2N+1` 확장 격자의 한 칸 이동 및 `isWalkableGridPosition` 충돌 판정을 유지한다.
- 플레이어 요소 크기는 기존 `1.4 * cellSize`를 유지하고 그 중심을 타일 중앙 `(col + 0.5, row + 0.5)`에 둔다.
- 벽 타일 이미지는 독립 PNG의 알파 여백을 고려해 칸 경계에 바닥색이 드러나지 않도록 채움 배경과 이미지 크기를 보정한다. `overflow: hidden`, 시드별 변형 및 장애물 점유 배치는 유지한다.

## Implementation

### I01. 플레이어 스프라이트 좌표를 칸 중심에 정렬
- Related Files:
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite`; modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: existing player sprite geometry expectations; modify existing assertions only

#### Details
- `PlayerSprite`의 위치 계산은 `cellSize = s`, `position.col = c`, `position.row = r`일 때 다음 식을 사용한다.
  - `spriteLeft = round((c + 0.5 - 0.7) * s * 100) / 100`, 즉 `(c - 0.2) * s`를 소수 둘째 자리로 반올림한다.
  - `spriteTop = round((r + 0.5 - 0.7) * s * 100) / 100`, 즉 `(r - 0.2) * s`를 소수 둘째 자리로 반올림한다.
- `1.4s` 스프라이트 상자의 중심이 `(c + 0.5)s, (r + 0.5)s`가 되게 한다. 현재 `(c - 0.7)s, (r - 0.7)s` 위치는 중심을 각 축에서 반 칸 앞당긴다.
- 같은 파일의 기존 테스트 `keeps one player sprite and image while interpolating between cell centers`에서 플레이어 시작 위치와 이동 후 위치 기대값을 새 중심 계산에 맞춘다. 새 테스트 케이스는 추가하지 않는다.
- 확장 격자 좌표, 카메라, 방향, 애니메이션, 입력, 충돌 코드는 수정하지 않는다.

### I02. 연결 벽 타일 경계의 투명 틈 보정
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.obstacleTile`, `.wallBlock`; modify
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`; read-only unless background needs inline implementation

#### Details
- `public/assets/maps/maze-*-wall-*.png`는 정사각형 캔버스 안에 큰 투명 여백을 포함하고, `.wallBlock`은 현재 `170%` 크기로 렌더링된다. 인접 타일 경계에 이미지의 투명 알파가 겹치지 않으면 보드 바닥이 선처럼 드러난다.
- CSS에서 벽 타일 전체 면에 `--wall-color`를 배경으로 사용해 투명 외곽이 보드 바닥을 노출하지 않게 한다.
- 벽 이미지 크기를 조정해 원본의 실제 불투명 부분이 타일 너비를 충분히 덮도록 한다. 원본은 약 1024x1024이며 주요 불투명 실루엣이 대략 x=220..810, y=280..990에 있으므로 185% 전후가 칸 경계를 덮는 시작점이다. 필요하면 해당 CSS 수치를 소폭 조정한다.
- 기존 중앙 정렬, `overflow: hidden`, 드롭 섀도, 이미지 로드 실패 fallback을 유지한다. 벽 타일이 열린 통로나 바닥 중심에 보이지 않게 하고, 셀 배치 및 테마 변형 로직은 바꾸지 않는다.

## Acceptance Criteria
- [x] 플레이어 이미지 요소의 중앙이 현재 플레이어 확장 격자 칸의 중앙과 일치한다.
- [x] 기존의 `1.4 * cellSize` 크기와 이동 좌표가 유지된다.
- [x] 서로 연결된 벽 타일 가장자리에서 바닥색이 틈으로 드러나지 않는다.
- [x] 벽 칸만 계속 장애물로 보이고 열린 통로 및 바닥 타일 렌더링은 그대로다.

## Validation
- `npm run build` — TypeScript 검사와 Vite 프로덕션 빌드가 통과해야 한다.

## Commit Message
```text
fix(maze): 플레이어와 장애물 타일 정렬

Plan: 2026-10-01-maze-obstacle-alignment
Phase: P01-render-alignment
Task: T01-player-and-obstacle-render-alignment

- 플레이어 스프라이트를 이동 칸 중앙에 정렬
- 투명 여백을 채워 장애물 타일 사이의 틈 제거
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending



