# Plan: 게임 내부 미로 시야 조금 확대

## Goal

[확정 결정](../decisions/2026-10-02-slightly-wider-maze-view.md)에 따라 맵틀 외형과 반응형 크기는 유지하고 내부 타일 크기만 `120px→108px`로 줄여 약 `11.48×7.78`칸을 보이게 한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 내부 타일 크기와 카메라 회귀값 조정·검증 | [P01](../phases/2026-10-02-slightly-wider-maze-view/P01-maze-zoom/phase.md) |

## Task Order

1. T01에서 타일 기준 크기를 조정하고 카메라·배율 테스트 및 실제 브라우저 시야를 검증한다.

## Boundaries

- `GameScreen`의 창 너비·높이 기반 맵틀 배율과 `1250×850` 외형을 유지한다.
- `MazeBoard`의 `1240×840` viewport, 카메라 공식, 플레이어·동물 상대 크기를 유지한다.
- 미로 생성, 이동·충돌·구출, 저장 형식과 캠페인·모바일 버튼·팝업을 변경하지 않는다.
