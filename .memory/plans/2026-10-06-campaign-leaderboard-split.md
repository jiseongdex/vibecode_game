# Plan: 단계 선택 화면의 랭킹·단계 분할 배치

## Goal

로그인 후 단계 선택 페이지에서 데스크톱은 왼쪽 절반에 계정 유형별 랭킹, 오른쪽 절반에 현재 계정의 단계 선택을 동시에 보여준다. `랭킹 보기` 전환을 없애고, 900px 이하 화면은 단계 선택 기본 탭과 랭킹 탭으로 보여준다. `1440×900px` 브라우저에서 로그인·단계 선택·게임플레이의 문서 스크롤을 없애며 단계 20개는 오른쪽 패널에 스크롤 없이 담고 랭킹은 10명씩 페이지네이션한다. 상단 `동물 구출 대작전` 제목·계정 영역의 박스형 외관을 제거한다.

## Confirmed Scope

- [결정 문서](../decisions/2026-10-06-campaign-leaderboard-split.md)의 D01~D09를 따른다.
- 랭킹 API, 간편 계정/Microsoft 분리, 단계 해금·재플레이 규칙, 인증·배포 설정은 변경하지 않는다.
- 기존 `2026-10-02-laptop-fit-fixed-maze-view`에서 구현한 게임 미로 배율을 재사용하고 회귀 검증한다. 작은 모바일·낮은 창에서는 내용 접근을 위한 스크롤을 허용한다.
- 기존 배포 Task `P03-release/T01-cloudflare-entra-deploy`와 이미 스테이징된 배포 변경을 보존한다. 이 계획을 마치면 해당 Task로 포인터를 복귀시킨다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 좌우 배치·압축 단계, 모바일 탭, 노트북 높이 맞춤, 랭킹 페이지네이션 | [P01](../phases/2026-10-06-campaign-leaderboard-split/P01-campaign-layout/phase.md) |

## Execution Order

1. `P01-T01`: 기존 두 화면을 1:1 작업 공간에 동시에 배치하고 단계 20개를 5열×4행의 작은 버튼으로 맞춘다. 버튼·돌아가기 전환을 제거하고 1440×900 문서/단계 패널 스크롤을 막는다.
2. `P01-T02`: 같은 작업 공간에 900px 이하 모바일 탭과 반응형 숨김 동작을 추가한다.
3. `P01-T03`: 상단 제목·계정 박스를 없애고 로그인 화면을 1440×900에 맞춘다. 기존 게임 미로 배율과 전체 화면의 스크롤 부재를 실제 크기에서 검증한다.
4. `P01-T04`: 기존 상위 100명 API 응답을 10명씩 페이지네이션하고 랭킹 패널 내부 스크롤을 제거한다.

## Completion and Resume

`P01-T04` 검증·커밋 후 이 계획을 `done`으로 표시하고 `.memory/current.md`의 Active Plan/Phase/Task를 기존 [배포 계획](./2026-10-02-dual-login-separated-rankings-free-deploy.md)의 `P03-release/T01-cloudflare-entra-deploy`로 되돌린다. Microsoft Entra 앱 등록과 실사용 검증은 그 Task에 남아 있다.

## Commit Isolation

`.memory/`는 `.gitignore`에 있으므로 새 계획·Phase·Task 파일을 커밋할 때는 필요한 메모 파일만 `git add -f`로 명시한다. 배포 파일 네 개가 이미 스테이징되어 있으므로 각 화면 변경 커밋은 해당 Task의 소스·테스트·메모 경로만 지정해 만들고, 배포 파일이 포함되지 않았는지 확인한다. `.gitignore`나 기존 배포 스테이징 상태는 바꾸지 않는다.
