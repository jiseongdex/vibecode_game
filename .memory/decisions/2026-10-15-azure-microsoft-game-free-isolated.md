# Decisions: Azure Microsoft 전용 게임의 무료·독립 배포

- Date: 2026-10-15
- Status: Confirmed

## D01. 두 서비스의 경계
- **Chosen**: 현재 Cloudflare Worker 주소와 D1은 유지한다. `CR-Project-01` 구독의 `grill-me-edu` 리소스 그룹에 동일한 게임을 새 Azure 앱으로 배포하고, 별도 Cosmos DB에 계정·진행·기록·랭킹을 저장한다. 두 DB 사이에 기존 기록을 복사하거나 자동 동기화하지 않는다.
- **Rationale**: 사용자가 두 배포와 DB의 완전한 독립을 요청했다. 같은 Microsoft 계정이라도 Azure판의 기록은 Azure판에서 새로 시작한다.

## D02. 로그인 범위
- **Chosen**: 새 Azure 앱에서는 Microsoft 로그인만 제공한다. 기존 Cloudflare 앱의 간편 로그인은 유지한다. Azure Microsoft 계정은 개인 계정과 회사·학교 계정을 모두 허용하며, 비로그인 플레이·랭킹 조회는 허용하지 않는다.
- **Rationale**: 이번 인터뷰에서 사용자가 Microsoft 전용 Azure판과 간편 로그인 Cloudflare판을 선택했다. 계정 유형 및 로그인 필수는 기존 확정 결정의 연장이다.

## D03. 무료 호스팅·API
- **Chosen**: Azure Static Web Apps Free 신규 리소스를 만들고, 같은 앱의 관리형 Azure Functions HTTP API를 사용한다. 기존 `swa-grill-us-prod-d0d6`는 수정하거나 재사용하지 않는다. 앱과 API는 한 Azure 주소의 같은 origin에서 제공한다. 무료 한도와 지원 범위를 넘기기 전에 확인하며, 유료 플랜으로 자동 전환하지 않는다.
- **Rationale**: Microsoft 문서상 Free 플랜은 정적 호스팅과 관리형 Functions API를 제공한다. 2026-10-15 읽기 전용 조회에서 구독의 Static Web Apps는 기존 Free 앱 1개였다.

## D04. Cosmos DB 무료 계층과 최소 처리량
- **Chosen**: `grill-me-edu`에 신규 Azure Cosmos DB for NoSQL 계정을 무료 계층으로 생성한다. 한 지역에 표준 수동 프로비저닝 방식의 **공유 데이터베이스 처리량 400 RU/s**를 설정하고, 게임의 여러 컨테이너가 이를 공유한다. 자동 크기 조정 및 추가 유료 기능·지역·처리량은 계획 범위에서 제외한다. Cosmos 접근 비밀값은 Azure 앱 설정에 보관한다.
- **Rationale**: 사용자가 비용 비교 후 무료 계층과 최소 400 RU/s를 명시적으로 선택했다. 2026-10-15 읽기 전용 조회에서 `CR-Project-01`의 기존 Cosmos 계정 5개 모두 `enableFreeTier=false`였다. Microsoft 문서상 무료 계층은 구독당 한 계정, 계정당 1000 RU/s와 25GB까지이며 생성 시 선택해야 한다. 수동 공유 처리량의 초기 최소치는 400 RU/s다. Serverless 계정에는 이 무료 계층이 적용되지 않는다.

## D05. Microsoft 인증과 표시 이름
- **Chosen**: Azure판에 별도 Microsoft Entra 앱 등록을 하고 Azure 주소의 callback으로 OIDC 로그인 응답을 서버에서 검증한다. 무료 Static Web Apps의 기본 제공 인증에서 확인하기 어려운 Microsoft 표시 이름은 검증된 ID 토큰의 이름 값으로 확보하고, 랭킹에 사용한다. Entra 앱 등록은 리소스 그룹이 아닌 테넌트의 항목이다.
- **Rationale**: 기존 결정에서 사용자는 이메일·사용자 이름 대신 Microsoft 표시 이름을 랭킹에 표시하도록 지정했다. Static Web Apps Free의 기본 인증이 관리형 API에 전달하는 정보는 사용자 ID 및 이메일·사용자 이름 중심이며, 사용자 지정 인증 공급자 등록은 Standard 플랜 기능이다. 별도 OIDC 흐름은 무료 호스팅과 기존 표시 이름 요구를 함께 충족한다.

## D06. 게임 동작과 데이터 모델
- **Chosen**: 기존 게임 화면·단계·무작위 미로·최고 단계 우선/같은 단계 최단 시간 순위·상위 100명/내 순위·계정별 진행 동기화·서버 측 시작/종료 기본 검증을 Azure판에 유지한다. 기존 D1 SQL API 구현은 Azure Functions와 Cosmos DB용 저장 계층으로 옮긴다. 만료된 로그인·도전 데이터의 정리 방식을 포함한다.
- **Rationale**: 사용자는 동일한 게임을 별도 배포하기 원한다. 현재 `worker/` 구현은 `D1Database`와 SQL에 직접 의존하므로 정적 파일만 옮겨서는 Azure 독립 DB가 동작하지 않는다.

## D07. 배포 운영
- **Chosen**: Azure판과 Cloudflare판은 한 코드베이스에서 별도 설정과 배포 대상으로 관리한다. Azure 배포가 Cloudflare Worker 또는 D1을 수정하거나 재배포하지 않도록 한다. 신규 Azure 기본 주소를 사용하며 사용자가 별도 도메인을 지정하기 전에는 도메인 구매를 포함하지 않는다. 리소스 그룹 위치인 Korea Central을 우선 검토한다.
- **Rationale**: 사용자가 기존 서비스를 그대로 두고 독립 Azure판을 요청했고, 무료 플랜을 선호했다. 2026-10-15 확인한 `grill-me-edu`의 위치는 `koreacentral`이다.

## D08. 기존 계획과의 관계
- **Chosen**: 기존 `.memory/current.md`가 가리키는 Cloudflare·Entra 실제 배포 Task는 Azure판의 Microsoft 로그인 연결로 범위가 변경되었음을 다음 계획 단계에서 반영한다. 이 인터뷰에서는 구현 코드와 기존 포인터를 변경하지 않는다.
- **Rationale**: 기존 Task는 Cloudflare `/microsoft`에 Entra 비밀값을 넣도록 작성되었지만, 사용자는 이제 Azure판 Microsoft 로그인과 Cloudflare판 간편 로그인을 선택했다.

## 확인 근거
- Azure Static Web Apps Free 기능 및 인증 제약: https://learn.microsoft.com/en-us/azure/static-web-apps/plans
- Azure Static Web Apps 기본 인증 사용자 정보: https://learn.microsoft.com/en-us/azure/static-web-apps/user-information
- Azure Cosmos DB 무료 계층: https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier
- Azure Static Web Apps 관리형 API: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview
