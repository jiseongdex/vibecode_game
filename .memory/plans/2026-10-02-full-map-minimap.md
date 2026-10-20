# Plan: 전체 지도 미니맵

## Goal

[확정된 결정](../decisions/2026-10-02-full-map-minimap.md)에 따라 맵 틀 내부 오른쪽 하단에 읽기 전용 전체 지도를 표시한다. 모든 벽은 선으로, 미구조 동물과 탈출구는 위치 마커로 표시한다. 실제 카메라가 보여 주는 범위를 테두리로 표시하고 그 바깥을 옅게 어둡게 하며, 플레이어 위치 점은 표시하지 않는다. 구조 상태·카메라 이동·화면 배율 변경이 즉시 반영되어야 한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 기존 미로와 카메라 좌표를 투영하고 미니맵 UI를 맵 틀에 통합·검증 | [P01](../phases/2026-10-02-full-map-minimap/P01-minimap/phase.md) |

## Task Order

1. [T01](../phases/2026-10-02-full-map-minimap/P01-minimap/T01-minimap-geometry.md): 벽 선분, 그리드 위치 마커, 실제 카메라 시야의 정규화 좌표를 순수 함수로 만들고 단위 검증한다.
2. [T02](../phases/2026-10-02-full-map-minimap/P01-minimap/T02-render-minimap.md): T01의 좌표를 사용해 전체 지도·마커·시야 테두리·바깥 음영을 렌더하고 `MazeBoard`에 통합한다.

## Boundaries

- 기존 `GameState.maze`, `player`, `exit`, `rescues[].rescued`와 `MazeBoard`의 `cameraOffset`, `cellSize`, `viewWidth`, `viewHeight`를 사용한다. 새 저장 필드와 게임 규칙은 만들지 않는다.
- 미니맵은 현행 `MazeBoard`의 실제 뷰포트 계산을 따른다. 별도 결정인 120px 타일·너비 기준 배율과 현행 108px 타일·높이 제한 배율의 차이는 사용자의 선택에 따라 이번 계획에서 수정하지 않는다.
- `src/components/MazeBoard/MazeBoard.test.tsx`의 기존 ‘미니맵 없음’ 단언은 T02에서 새 요구사항으로 바꾼다.
- `.memory/`는 현재 `.gitignore` 대상이다. 실행 단계에서 계획 문서를 커밋하려면 해당 파일을 명시적으로 강제 스테이징한다.
