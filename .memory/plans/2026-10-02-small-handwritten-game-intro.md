# Plan: 시작 안내 문구 손글씨와 크기 조정

## Goal

단계 진입 안내 문구는 기존 3초 안내 → 3·2·1 → 자동 시작 순서 그대로, 기존 로컬 손글씨 폰트로 바꾼다. 문구와 숫자를 모두 줄여 미로 틀 안쪽 중앙에 부담 없이 표시한다. 재도전·저장 복원·입력 차단 흐름은 유지한다.

## Source Decisions

- [확정 결정](../decisions/2026-10-02-small-handwritten-game-intro.md)
- 이전 [시작 연출 계획](./2026-10-02-random-animal-cute-game-intro.md)은 완료되었으며 이번 계획은 시각 표현만 후속 조정한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 안내 문구 손글씨와 문구·숫자 축소를 CSS 한 곳에서 수정하고 검증 | [P01](../phases/2026-10-02-small-handwritten-game-intro/P01-intro-typography/phase.md) |

## Sequence

1. T01: `GameScreen.module.css`의 안내 문구에 Nanum Pen Script를 적용하고 문구·숫자 크기를 줄인다. 기존 화면·게임 테스트와 빌드로 시작 흐름 회귀를 확인한다.

## Completion Gate

- 단계 진입 시 안내 문구가 먼저 표시되고 숫자 카운트다운 후 자동 시작하는 동작은 그대로다.
- 같은/새 미로 재도전은 숫자만 표시한다.
- 문구는 Nanum Pen Script, 숫자는 Jua이며 두 표시 모두 기존보다 작고 미로 안쪽 중앙에 놓인다.
- 지정 테스트와 전체 테스트, 빌드가 통과한다. 브라우저 연결이 있으면 데스크톱·모바일·낮은 가로 화면의 시각적 가독성을 확인한다.
