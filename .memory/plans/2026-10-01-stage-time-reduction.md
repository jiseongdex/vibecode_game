# Plan: 단계별 제한 시간 단축

## Goal
1~20단계의 기존 시간 증가 방식을 유지하면서 각 제한 시간을 약 20% 줄인다. 1단계 98초, 20단계 604초가 되고, 새로 시작하거나 재시도할 때 같은 규칙이 적용된다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 단계 시간 공식과 기존 기대값 조정 | [P01](../phases/2026-10-01-stage-time-reduction/P01-time-formula/phase.md) |

## Decisions
[단계별 제한 시간 단축 결정](../decisions/2026-10-01-stage-time-reduction.md)의 D01~D03을 따른다. 미로 크기, 구출 수, 타이머 동작, HUD 표시 형식은 바꾸지 않는다.
