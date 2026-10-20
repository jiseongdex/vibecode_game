# Plan: 플레이어 방향 전환 부드럽게 표시

## Goal
기존 네 방향 플레이어 이미지로 약 0.1초의 방향 전환 효과를 표시한다. 이동·충돌·걷기 프레임은 유지하고 반복 입력이나 모션 감소 설정에서 불필요한 효과를 피한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 플레이어 방향 전환 표시와 회귀 검사 추가 | [P01](../phases/2026-10-01-smooth-player-turning/P01-turn-transition/phase.md) |

## Decisions
[확정된 방향 전환 결정](../decisions/2026-10-01-smooth-player-turning.md)을 따른다. 플레이어 이미지·게임 상태·저장 스키마는 변경하지 않는다.
