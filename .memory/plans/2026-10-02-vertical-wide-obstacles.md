# Plan: 가로형 장애물의 세로 벽 회전

## Goal

[확정 결정](../decisions/2026-10-02-vertical-wide-obstacles.md)에 따라 사탕 02·얼음 03·사막 03 이미지를 세로 벽 슬롯에서만 90도 회전한다. 가로 벽과 연결점, 기존 135% 크기와 게임 동작은 유지한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 에셋별 세로 회전 설정·렌더링·검증 | [P01](../phases/2026-10-02-vertical-wide-obstacles/P01-wall-orientation/phase.md) |

## Task Order

1. T01에서 테마 variant의 회전 설정을 추가하고 좌·우 벽에서만 적용한 뒤 테스트와 브라우저 화면을 확인한다.

## Boundaries

- 사탕 variant1, 얼음·사막 variant2의 `left/right` 벽 슬롯만 회전한다.
- `up/down`, `side`가 없는 연결점, 다른 variant와 숲 테마는 회전하지 않는다.
- 현재 장애물 표시 크기, 벽 좌표·충돌·깊이 순서, 맵 시야와 저장 데이터는 유지한다.
