# Task: T01 탈출구 한 칸 렌더링

## Status: done

## Goal
출구 좌표가 가리키는 바닥 중심 렌더 칸 안에 탈출구 이미지와 해금 효과를 넣고 장애물에 가려지지 않게 한다.

## Decision Summary
- 출구는 이미 `MazeBoard`의 `isExit` 조건으로 한 `MazeCell`에 렌더링된다. 좌표와 승리 판정은 변경하지 않는다.
- `.exitSprite`는 `.sprite`의 기본 `1.4 * cellSize` 상자와 `translate(-50%, -50%)`를 덮어써 한 칸 크기, 한 칸 원점에 맞춘다.
- 장애물 7, 출구 8, 플레이어 9 표시 순서를 사용한다. 출구 PNG의 투명도는 유지한다.
- 모델·저장 스키마·API 필드는 변경하지 않는다.

## Implementation

### I01. 탈출구 상자 한 칸 크기와 위치
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.exitSprite`; modify
  - `src/components/Exit/ExitSprite.tsx` :: `ExitSprite`; read-only
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`; read-only

#### Details
- `.exitSprite`에 `width: var(--cell-size)`, `height: var(--cell-size)`, `inset: 0`, `transform: none`을 설정한다. `position: absolute`는 `.sprite`에서 유지하고 부모 `.cell`은 `position: relative`이다.
- `.exitSprite`의 `overflow: hidden`으로 PNG와 자식 시각 효과가 한 칸 밖으로 새지 않게 한다.
- `z-index`를 `1`에서 `8`로 올린다. 기존 장애물 `7`, 플레이어 `9`는 수정하지 않는다.
- `.exitSprite`의 `filter: grayscale(0.75)`는 잠긴 상태에 유지한다. 인라인 `backgroundColor: 'transparent'`와 `<img>` PNG 사용도 유지한다.

### I02. 해금 빛 효과를 이미지에 제한
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.exitUnlocked`, `.exitUnlocked img`; modify

#### Details
- `.exitUnlocked`는 `filter: none`만 유지해 부모 상자에 칸 밖으로 퍼지는 drop shadow를 적용하지 않는다.
- `.exitUnlocked img`에 `filter: drop-shadow(0 0 4px #44804a)`를 적용한다. 부모의 `overflow: hidden`이 빛 효과를 출구 칸 안으로 자른다.
- 이미지가 로드 실패로 숨겨질 때 기존 이모지 대체 표시가 가능해야 한다.

## Acceptance Criteria
- [x] 탈출구 상자와 이미지가 부모 바닥 렌더 칸의 정확한 한 칸 크기 안에 있다.
- [x] 탈출구가 장애물에 가려지지 않고 플레이어 아래에 보인다.
- [x] 잠김 회색 표시와 해금 빛 효과, PNG 투명 배경이 유지된다.
- [x] 출구 좌표·승리 판정·바닥 칸 렌더링이 유지된다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 기존 출구 렌더링과 보드 동작 검사 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 탈출구를 한 칸에 맞춰 표시

Plan: 2026-10-01-exit-single-tile
Phase: P01-exit-rendering
Task: T01-exit-single-tile-rendering

- 탈출구 이미지와 효과를 한 렌더 칸에 제한
- 탈출구를 장애물 위에 표시
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
