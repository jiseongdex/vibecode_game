# Plan: 막힌 플레이어의 크기 안정화

## Goal
장애물 아래쪽에서 이동이 막힌 채 방향 키를 반복해도 플레이어 그림이 커졌다 작아지지 않게 한다. 실제 이동의 걷기 애니메이션은 유지한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 좌표 변화가 있는 이동에만 걷기 프레임 적용 | [P01](../phases/2026-10-01-blocked-player-size/P01-blocked-motion/phase.md) |

## Decisions
[원인과 표시 규칙](../decisions/2026-10-01-blocked-player-size.md)의 D01~D03을 따른다. 진행 중인 [웹 UI 디자인 결정](../decisions/2026-10-01-cute-game-web-ui.md)은 변경하지 않는다.
