# Plan: 빠른 동물 이동의 깜박임 개선

## Goal

빠른 연속 이동과 방향 전환에서도 따라오는 동물의 이미지가 다시 생성되지 않고 플레이어처럼 연속적으로 움직이게 한다.

## Source Decision

[확정 결정](../decisions/2026-10-02-follower-motion-flicker.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 동물 위치 전환과 방향 이미지의 연속성 개선 | [P01](../phases/2026-10-02-follower-motion-flicker/P01-continuous-follower-motion/phase.md) |

## Sequence

1. T01에서 `RescueSprite`의 이미지 요소를 유지하고 방향 이미지를 미리 로드한다.
2. 동물 위치를 `translate`로 전환해 플레이어와 같은 시간·방식으로 움직인다.
3. 빠른 이동, 방향 전환, 오류 후 이미지 회복과 기존 구출 화면을 검증한다.

## Completion Gate

- 같은 동물이 빠르게 움직이고 돌아도 DOM 이미지 요소가 유지된다.
- 위치는 120ms `translate` 전환을 사용한다.
- 구출 전 철장과 방향별 동물 이미지는 유지되고 전체 테스트와 빌드가 통과한다.
