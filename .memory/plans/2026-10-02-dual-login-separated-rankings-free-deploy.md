# Plan: 두 로그인 방식과 분리된 랭킹의 무료 웹 배포

## Goal

동일한 무료 Cloudflare Workers 주소의 `/microsoft`와 `/simple`에서 각각 로그인해야 20단계 미로 게임을 플레이할 수 있게 한다. Cloudflare D1은 계정별 해금 단계와 최고 시간, 로그인 유형별 전체 기간 랭킹을 보관한다. 랭킹에는 최고 완료 단계와 그 단계의 최단 시간을 표시하고, 유형별 상위 100명과 내 순위를 보여준다. 실제 배포 주소에서 두 로그인 방식, 기록 동기화, 유형 분리를 확인한다.

## Confirmed Scope

- [결정 문서](../decisions/2026-10-02-dual-login-separated-rankings-free-deploy.md)의 D01~D15가 이 계획의 기준이다.
- 비회원에게 게임을 렌더링하지 않는다. 기존 브라우저 저장 기록을 새 계정으로 가져오지 않는다.
- 로그인 계정의 해금 단계와 단계별 최고 기록만 기기 간 동기화한다. 일시정지 중인 미로는 계정별 로컬 저장에 남긴다.
- 온라인 클리어는 서버 발급 도전 식별자와 시간·단계 기본 검증을 거친다. 무작위 미로와 클라이언트 판정에 따른 잔여 부정행위 가능성은 문서화한다.
- Cloudflare와 Microsoft 계정은 아직 준비되지 않았다. 마지막 Phase에서 실제 계정 연결과 배포를 수행한다.
- 기존 `.gitignore`가 `.memory/`를 제외한다. 사용자의 선택에 따라 이번 계획에서는 Git 추적 방침을 바꾸지 않으며 청사진·진행률은 현재 작업 공간의 로컬 파일로 유지한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | D1 스키마, Worker API, 두 인증 방식, 기록·랭킹 서버 규칙 | [P01](../phases/2026-10-02-dual-login-separated-rankings-free-deploy/P01-auth-and-record-api/phase.md) |
| P02 | `done` | 로그인 관문, 계정별 게임 저장·동기화, 랭킹 화면 | [P02](../phases/2026-10-02-dual-login-separated-rankings-free-deploy/P02-game-client/phase.md) |
| P03 | `in_progress` | Cloudflare·Microsoft 설정, 원격 DB 적용, 실제 배포와 확인 | [P03](../phases/2026-10-02-dual-login-separated-rankings-free-deploy/P03-release/phase.md) |

## Execution Order

`P01-T01` → `P01-T02` → `P01-T03` → `P01-T04` → `P01-T05` → `P02-T01` → `P02-T02` → `P02-T03` → `P03-T01`. 각 Task는 자기 파일의 Validation과 Commit Message를 기준으로 순차 실행한다.

## Release Gates

1. 모든 Task의 지정 테스트, `npm.cmd run lint`, `npm.cmd run build`가 통과한다.
2. `/microsoft`와 `/simple` 모두 비로그인 상태에서 게임·랭킹 API가 차단된다.
3. 간편 가입/로그인과 Microsoft 실제 계정 로그인·로그아웃을 배포 주소에서 확인한다. 개인·조직 계정 유형은 OIDC 테스트와 앱 등록 설정으로 모두 검증하고, 조직 실계정 접근이 가능하면 실제 로그인까지 확인한다. 조직별 관리자 동의 정책이나 테스트 계정 부재는 배포 기록에 남긴다.
4. 유형별 랭킹이 섞이지 않고, 다른 기기에서 해금 단계·최고 시간은 복원되며 진행 중 미로는 복원되지 않는다.
5. 비밀값과 PIN 원문은 저장소·응답·로그에 남지 않는다. 무료 한도와 운영 절차를 문서화한다.
