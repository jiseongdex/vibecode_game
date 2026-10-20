# 계획: 미로 구출 게임

## 목표

React + TypeScript 기반의 웹 미로 게임을 구현한다. 플레이어는 절차적으로 생성된 완벽한 미로에서 20개 단계를 순차적으로 진행하며, 단계별 구출 대상 1~5명을 모두 구출한 뒤 탈출구에 도착해야 한다. 매번 새로운 미로를 생성하고, 단계 크기·구출 인원·제한 시간으로 난이도를 높인다. 진행 중인 게임은 버전 관리형 `localStorage`에 저장하고 페이지 복귀 시 일시정지 후 이어할 수 있게 한다.

## 완료 기준

- 20단계 순차 해금과 완료 단계 재플레이가 동작한다.
- 15×15에서 33×33까지 증가하는 완벽 미로가 매 실행마다 새롭게 생성된다.
- 구출 대상 전원 구출 후 탈출구 도착으로만 클리어된다.
- 키보드 및 화면 방향 버튼 조작, 카메라 추적, 제한 시간, 실패/재도전 흐름이 동작한다.
- 새로고침·탭 전환·브라우저 재실행 후 저장된 게임을 이어할 수 있다.
- `npm run build`와 테스트 명령이 통과한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | Vite 기반과 미로/게임 도메인 엔진 | [P01](../phases/2026-09-29-maze-rescue-game/P01-foundation-engine/phase.md) |
| P02 | `done` | 플레이 화면, 조작, 목표 처리, HUD | [P02](../phases/2026-09-29-maze-rescue-game/P02-gameplay-ui/phase.md) |
| P03 | `in_progress` | 저장/복귀, 로컬 에셋, 반응형 검증 | [P03](../phases/2026-09-29-maze-rescue-game/P03-persistence-assets-validation/phase.md) |
