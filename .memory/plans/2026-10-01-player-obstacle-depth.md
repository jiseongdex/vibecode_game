# Plan: 플레이어와 장애물의 깊이 표현

## Goal
확대된 플레이어가 장애물 위에 떠 보이지 않도록 화면의 아래쪽 장애물이 플레이어 발 일부를 가리고, 위쪽 장애물은 플레이어 뒤에 보이게 한다. 이동 중에도 같은 규칙을 적용하면서 구출 동물과 탈출구의 가시성을 유지한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 시각 격자 행에 따른 레이어 깊이 적용 | [P01](../phases/2026-10-01-player-obstacle-depth/P01-row-depth/phase.md) |

## Decisions
[확정된 겹침 규칙](../decisions/2026-10-01-player-obstacle-depth.md)의 D01~D04를 따른다. 게임 좌표, 충돌, 카메라, 플레이어 크기와 애니메이션은 변경하지 않는다.
