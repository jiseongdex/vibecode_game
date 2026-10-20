# Plan: 맵 틀 비례 미니맵 크기와 투명도

## Goal

[확정된 결정](../decisions/2026-10-02-proportional-minimap-size.md)에 따라 미니맵 외곽의 한 변을 맵 틀 내부 너비의 `24%`로 유지한다. 기존 `88px`·`240px` 크기 제한을 제거하고, 외곽 테두리를 `1px`, 미니맵 전체 불투명도를 `70%`로 조정한다. 전체 지도·마커·시야·오른쪽 하단 고정 동작은 유지한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 미니맵 CSS 조정과 기존 기능 회귀 검증; 브라우저 시각 확인은 미실시로 기록 | [P01](../phases/2026-10-02-proportional-minimap-size/P01-minimap-presentation/phase.md) |

## Task Order

1. [T01](../phases/2026-10-02-proportional-minimap-size/P01-minimap-presentation/T01-proportional-minimap-style.md): 미니맵의 크기·테두리·전체 투명도를 함께 바꾸고 회귀 검증한다.

## Boundaries

- `MiniMap.module.css`의 `.minimap` 외곽 표시 규칙만 수정한다. 마커·벽·시야 투영, 게임 상태, 저장 형식, 카메라, 맵 틀 배율 로직은 변경하지 않는다.
- CSS 선언을 그대로 읽는 단위 테스트는 실제 브라우저의 `%` 너비 계산이나 합성 불투명도를 검증하지 못한다. 기존 `MazeBoard` 회귀 테스트·빌드를 실행하고, 가능한 경우 실제 브라우저의 `getBoundingClientRect()`·`getComputedStyle()`로 크기와 표시를 확인한다.
- 기존 120px 타일 결정과 현행 108px 코드의 차이는 사용자가 별도 작업으로 남기기로 선택했으므로 이번 계획에 포함하지 않는다.
- `.memory/`는 `.gitignore` 대상이다. 실행 단계에서 Task 청사진을 커밋하려면 명시적으로 강제 스테이징한다.
