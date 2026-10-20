# Plan: 따라오는 동물의 자연스러운 이동

## Goal

구출한 동물이 이동할 때 수직 점프와 착지 변형을 없애고 기존의 부드러운 위치 전환을 유지한다.

## Source Decision

[확정 결정](../decisions/2026-10-02-smooth-animal-followers.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 동물 점프 코드 제거와 이동 회귀 검증 | [P01](../phases/2026-10-02-smooth-animal-followers/P01-follower-motion/phase.md) |

## Sequence

1. T01에서 `RescueSprite`의 점프 상태와 `MazeBoard`의 동물 이동 판정 전달을 제거하고 CSS 점프 효과를 삭제한다.
2. 동물의 위치·방향·새 동료 표시가 유지되는지 테스트하고 빌드한다.

## Completion Gate

- 동물은 점프하지 않고 120ms 위치 전환으로 따라온다.
- 플레이어 이동과 구출 전 철장에는 변화가 없다.
- 관련 테스트와 전체 테스트, 빌드가 통과한다.
