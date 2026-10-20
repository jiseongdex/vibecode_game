# Plan: 랭킹 20칸과 중앙 타이틀

## Goal

랭킹 행 간격을 넓히고 한 페이지에서 20개 순위 자리를 볼 수 있게 한다. 게임 타이틀은 데스크톱 화면 가운데에 위치시키고 닉네임·로그아웃은 오른쪽에 유지한다.

## Confirmed Scope

- [결정 문서](../decisions/2026-10-08-leaderboard-20-centered-title.md)의 D01~D04를 따른다.
- 서버 순위·공동 순위·상위 100명 한도, 모바일 탭, 단계 그림 버튼은 유지한다.
- 배포 Task의 기존 스테이징 파일을 이번 화면 커밋에서 제외한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 20칸 랭킹과 중앙 헤더 | [P01](../phases/2026-10-08-leaderboard-20-centered-title/P01-layout/phase.md) |

## Execution Order

`P01-T01`에서 랭킹 페이지 크기·패널 스크롤과 헤더 가운데 정렬을 함께 구현한다. 두 변경 모두 1440×900 화면 높이와 좌우 균형을 결정하므로 한 번의 브라우저 검증으로 묶는다.

## Completion and Resume

화면 Task의 검증·커밋·Phase 완료 후 `.memory/current.md`를 [배포 계획](./2026-10-02-dual-login-separated-rankings-free-deploy.md)의 `P03-release/T01-cloudflare-entra-deploy`로 복귀시킨다. Microsoft Entra 연결이 남은 배포 Task는 완료로 표시하지 않는다.
