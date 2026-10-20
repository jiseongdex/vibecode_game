# Current Context

## Active Plan

[Azure Microsoft 전용 게임 독립 배포](./plans/2026-10-15-azure-microsoft-game-free-isolated.md)

## Active Phase

[P03 독립 Azure 배포](./phases/2026-10-15-azure-microsoft-game-free-isolated/P03-azure-release/phase.md)

## Active Task

없음 (Azure Microsoft 전용 게임 독립 배포 계획 완료)

## Status

- T01 Azure Functions 프로젝트와 Cosmos 저장소 완료 (`67364ec`).
- T02 Microsoft OIDC 로그인과 Azure 세션 완료 (`f4a0bcd`).
- T03 도전·진행·랭킹 API 완료 (`c11e26b`).
- T04 관리형 Functions HTTP 라우팅과 배포 패키지 완료 (`a0cd542`).
- P01 4/4, P02 1/1 완료. P02-T01 커밋: `d7bc8b9`.
- P03 1/1 완료. Azure 새 자원·Entra 앱·배포 문서와 인덱스 정책은 `5d798d1`로 커밋했다. Azure 기본 주소 전환은 `0c223ea`다.
- Cosmos에 서로 다른 조직 계정 사용자 2명이 저장됐다. 개인 Microsoft 테스트 계정이 없어 실로그인은 미검증이며, 사용자가 제한을 기록하고 배포를 완료하기로 선택했다.
- 이전 포인터의 Cloudflare·Entra 실제 배포는 새 Azure Microsoft 배포 결정으로 대체됨. 기존 Cloudflare 배포와 D1은 유지한다.
- `.memory/`는 로컬 전용이며 Git에 강제 추가하지 않는다.

## Next Step (IMPORTANT)

필수 다음 Task 없음. 개인 Microsoft 계정을 이용할 수 있게 되면 별도 검증으로 로그인·로그아웃·랭킹 분리를 확인하고 `docs/azure-deployment.md`의 미검증 항목을 갱신한다.
