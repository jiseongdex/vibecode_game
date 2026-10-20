# Plan: 키보드 연속 이동 개선

## Goal
키를 누르는 동안 첫 이동 뒤 긴 공백 없이 일정한 속도로 한 칸씩 이동시키고, 플레이어·카메라의 보간 시간을 입력 주기에 맞춘다. 짧은 키 탭은 한 칸만 움직이며 키 해제·포커스 상실·게임 중단에서 반복 이동을 멈춘다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 키 유지 타이머와 플레이어·카메라 애니메이션 정렬 | [P01](../phases/2026-10-01-smooth-keyboard-movement/P01-input-and-animation/phase.md) |

## Decisions
[결정 사항](../decisions/2026-10-01-smooth-keyboard-movement.md)을 따른다. 기존 칸 좌표, 충돌 규칙, 구조 대상 위치, 모바일 버튼의 클릭 단위 이동은 유지한다.

