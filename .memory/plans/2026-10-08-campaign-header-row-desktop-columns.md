# Plan: 제목 행과 데스크톱 랭킹·단계 배치 정리

## Goal

단계 선택 화면의 제목·닉네임·로그아웃을 데스크톱에서 한 행에 배치하고, 완료·해금 요약 문구를 없앤다. 901px 이상에서는 창이 낮아도 랭킹 왼쪽·단계 오른쪽을 유지한다.

## Confirmed Scope

- [결정 문서](../decisions/2026-10-08-campaign-header-row-desktop-columns.md)의 D01~D04를 따른다.
- 900px 이하의 기존 탭, 계정별 랭킹, 단계 해금 데이터와 배포 파일은 변경하지 않는다.
- 1440×900의 기존 문서·단계·랭킹 패널 무스크롤을 검증한다. 1213×600 등의 낮은 데스크톱은 세로 배치 대신 문서 스크롤을 허용한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 헤더 한 행, 진행 요약 제거, 폭 기준 데스크톱 배치 | [P01](../phases/2026-10-08-campaign-header-row-desktop-columns/P01-layout/phase.md) |

## Execution Order

`P01-T01`에서 세 변경과 회귀 검증을 함께 완료한다. 헤더·단계 패널·작업 공간 CSS가 한 화면의 높이를 함께 결정하므로 하나의 검증 가능한 Task로 묶는다.

## Completion and Resume

`P01-T01` 커밋 후 이 계획과 Phase를 `done`으로 표시하고 `.memory/current.md`를 기존 [배포 계획](./2026-10-02-dual-login-separated-rankings-free-deploy.md)의 `P03-release/T01-cloudflare-entra-deploy`로 복귀시킨다. 배포 Task 자체는 완료로 표시하지 않는다.

## Commit Isolation

화면 소스·테스트와 이 계획의 필요한 `.memory` 파일만 명시해 커밋한다. 기존 스테이징 `.dev.vars.example`, `README.md`, `docs/deployment.md`, `wrangler.jsonc`는 포함하지 않는다.
