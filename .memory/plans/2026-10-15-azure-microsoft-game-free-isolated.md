# Plan: Azure Microsoft 전용 게임 독립 배포

## Goal

`CR-Project-01` 구독의 `grill-me-edu` 리소스 그룹에 새 Azure Static Web Apps Free 게임과 독립 Cosmos DB for NoSQL Free 계정을 배포한다. Microsoft 개인/조직 계정으로 로그인한 사람만 게임과 Microsoft 전용 랭킹을 이용한다. 기존 Cloudflare Worker, D1, URL, 간편 로그인 및 데이터는 수정하거나 이관하지 않는다. Azure 앱과 HTTP API는 하나의 Azure 기본 HTTPS origin에서 제공한다.

## Decisions and release gates

- [확정 결정](../decisions/2026-10-15-azure-microsoft-game-free-isolated.md)을 따른다. Entra 앱 등록은 Azure판 전용이며 테넌트 수준 객체이다.
- Cosmos Free는 계정 생성 시 `enableFreeTier=true`, 단일 지역, 단일 공유 처리량 DB 400 RU/s, 전용 처리량 없음으로 구성한다. 가입 후 리소스 속성과 과금 경계를 읽어서 검증한다.
- Microsoft `name` 클레임을 검증된 ID 토큰에서 읽는다. SWA Free의 기본 인증 헤더만으로 표시 이름을 추측하지 않는다.
- Azure Functions 관리형 API는 HTTP만 사용한다. 만료 세션·OAuth 흐름·시도는 Cosmos TTL로 정리하고 매 요청에서 만료도 검증한다.
- 기존 `worker/`, `wrangler.jsonc`, Cloudflare D1은 Azure 태스크에서 변경하지 않는다. 커밋 직전 index를 확인해 Cloudflare 문서/설정이나 다른 작업의 변경을 Azure 커밋에 섞지 않는다.
- 이전 계획의 `P03-T01 Cloudflare·Microsoft 실제 배포` 중 Microsoft 연결 부분은 이 계획으로 대체한다. Cloudflare의 `/microsoft`는 기존 코드/배포 상태로 남으며 이번 릴리스 검증 대상에서 제외한다. 새 포인터가 이 계획을 가리킨다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | Cosmos 모델, Microsoft OIDC, 게임 API, Functions 호스트 | [P01](../phases/2026-10-15-azure-microsoft-game-free-isolated/P01-azure-api/phase.md) |
| P02 | `done` | Azure 전용 로그인 경로와 정적 빌드 | [P02](../phases/2026-10-15-azure-microsoft-game-free-isolated/P02-azure-client/phase.md) |
| P03 | `done` | 독립 Azure 자원 생성, Entra 등록, 배포, 운영 점검 | [P03](../phases/2026-10-15-azure-microsoft-game-free-isolated/P03-azure-release/phase.md) |

## Completion

Azure URL에서 개인/조직 Microsoft 로그인, 로그아웃, 1단계 완료·2단계 해금, 재로그인 후 동기화, 최고 단계/시간 랭킹, 비로그인 API 거부를 실제 HTTPS로 검증한다. 새 Cosmos 계정이 Free 계층이며 공유 DB가 400 RU/s인지 확인하고 기존 Cloudflare `/simple` 및 D1의 기존 상태를 변경하지 않았음을 확인한다.

2026-10-15 완료 범위 조정: 개인 Microsoft 테스트 계정이 없어 사용자가 개인 로그인 실검증을 생략하고 제한을 기록한 채 완료하기로 선택했다. 실제 HTTPS에서 공개 경로·비로그인 API·조직 계정 두 명의 분리 저장·한 명의 1단계 완료를 확인했다. 개인 로그인·브라우저 쿠키·실제 랭킹·다른 브라우저 복원과 D1 원격 행 수 등 확인하지 못한 항목은 [운영 문서](../../docs/azure-deployment.md)에 별도 표시했다. Free SKU와 400 RU/s는 리소스 읽기 값으로 확인했다.
