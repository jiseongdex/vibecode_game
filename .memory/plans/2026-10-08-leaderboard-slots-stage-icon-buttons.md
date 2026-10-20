# Plan: 랭킹 고정 순위와 그림 단계 버튼

## Goal

랭킹에서 설명 문구를 빼고 내 기록을 최상단에 고정한다. 아래 목록은 기록이 없어도 1~10위 자리를 보여주며 기존 페이지네이션으로 최대 100명까지 탐색한다. 단계 선택의 사각형 버튼을 기존 그림과 단계 글자만 있는 버튼으로 바꾼다.

## Confirmed Scope

- [결정 문서](../decisions/2026-10-08-leaderboard-slots-stage-icon-buttons.md)의 D01~D05를 따른다.
- API·D1·서버 순위 규칙·모바일 탭·배포 설정은 유지한다.
- 기존 배포 작업 스테이징 파일과 이전 계획의 후처리 변경은 이번 두 커밋에서 제외한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 랭킹 자리와 단계 그림 버튼 UI | [P01](../phases/2026-10-08-leaderboard-slots-stage-icon-buttons/P01-campaign-ui/phase.md) |

## Execution Order

1. `P01-T01`: 내 기록 상단 고정, 10개 순위 자리, 페이지네이션·빈 상태 테스트.
2. `P01-T02`: 단계 그림 버튼과 회색 잠금 상태, 단계 동작·화면 크기 검증.

## Task Boundary

랭킹은 `LeaderboardDto`와 계정 표시 이름 전달 경로를 함께 바꿔야 독립적으로 검증된다. 단계 버튼은 별도 컴포넌트·CSS라 다음 Task에서 검증하고 커밋한다.

## Completion and Resume

두 Task의 커밋과 Phase 완료 후 `.memory/current.md`를 기존 [배포 계획](./2026-10-02-dual-login-separated-rankings-free-deploy.md)의 `P03-release/T01-cloudflare-entra-deploy`로 되돌린다. Microsoft Entra 연결이 남은 배포 Task는 완료로 표시하지 않는다.
