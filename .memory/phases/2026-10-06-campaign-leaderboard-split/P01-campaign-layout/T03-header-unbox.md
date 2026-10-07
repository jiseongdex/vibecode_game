# Task: T03 상단 박스 제거와 로그인·게임 화면 높이 맞춤

## Status: done

## Goal

상단 제목·계정 박스 외관을 제거하고 로그인 방식 선택·간편/Microsoft 로그인 화면을 `1440×900px`에 맞춘다. 기존 게임 미로 배율을 사용해 게임플레이도 이 크기에서 문서 스크롤 없이 보이는지 검증한다.

## Decision Summary

- 결정 D05·D06·D09: 박스 제거 대상은 상단 제목·계정 `header`다. 로그인 카드·게임 보드·랭킹 패널의 테두리는 유지한다. 1440×900 노트북에서는 로그인·선택·게임의 문서 세로/가로 스크롤이 없어야 한다.
- 게임은 이미 `GameScreen.sceneScale`을 HUD와 남은 높이로 계산한다. 먼저 실제 화면을 검증하고 회귀가 관측될 때만 크기 계산을 수정한다.
- 배포 Task의 기존 스테이징 변경은 이 Task 커밋에 포함하지 않는다. 다음 활성 Task는 T04 랭킹 페이지네이션이다.

## Implementation

### I01. 인증된 화면의 상단 헤더 외관 정리

- Related Files:
  - `src/styles/global.css` :: `body > #root > main > header` — 컨테이너 박스 외관 제거; modify
  - `src/styles/responsive.css` :: 같은 헤더의 미디어 규칙 — 모바일·가로 방향 간격 영향 확인; read-only, 필요한 경우에만 modify
  - `src/App.tsx` :: `AuthenticatedGame` 상단 `<header>` — 제목·안내·계정 요소 보존 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // AuthenticatedGame의 기존 JSX 요소와 콜백 타입은 변경하지 않는다.
  // account.user.displayName: string
  // onSignOut: () => Promise<void>
  ```
- **Data & Schema Fields**:
  - 계정·랭킹·단계 데이터 모델 변경 없음. 헤더는 기존 표시 이름과 로그아웃 액션을 그대로 쓴다.
- **Execution Flow / Logic**:
  1. `global.css`의 `body > #root > main > header`에서 `border`, `border-radius`, `background`, `box-shadow`로 생기는 독립 카드 외관을 제거한다. 폭 `min(calc(100% - 32px), 1240px)`, 중앙 정렬, 적절한 상하 여백과 텍스트 정렬은 유지한다. 필요하면 패딩만 시각적으로 조정한다.
  2. `responsive.css`의 600px/400px 및 낮은 가로 방향 헤더 크기·여백 규칙을 확인한다. 박스 제거 후 공간이 어색해진 경우에만 최소 조정한다. `.account-toolbar` 오른쪽 정렬과 로그아웃 버튼 초점 표시를 유지한다.
  3. `App.tsx`의 `<h1>`, 안내 `<p>`, `.account-toolbar` 내용은 수정하지 않는다. 게임 세션 중 헤더가 숨겨지는 조건을 유지한다. 별도 로그인 카드와 랭킹·단계 패널의 테두리는 변경하지 않는다.

### I02. 로그인 카드의 노트북 높이 맞춤

- Related Files:
  - `src/components/Auth/LoginScreen.module.css` :: `.page`, `.card`, `.intro`, `.note`, `.tabs`, `.back` — 로그인 방식 선택·간편/Microsoft 카드의 세로 간격 정리; modify
  - `src/components/Auth/LoginScreen.tsx` :: `RouteChoice`, `LoginScreen` — 내용·폼 구조 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // LoginScreen props: authType: AuthType;
  // onAuthenticated: (session: SessionDto) => void.
  // RouteChoice(): ReactElement; 입력·인증 로직 변경 없음.
  ```
- **Data & Schema Fields**:
  - `SessionDto`, 닉네임·PIN 입력, 오류 상태와 인증 API 변경 없음. 카드 높이만 스타일로 조정한다.
- **Execution Flow / Logic**:
  1. `.page`의 `min-height: 100dvh`와 중앙 정렬은 유지한다. 1440×900에서 카드 + 위아래 padding이 900px을 넘지 않도록 `.card`의 현재 최대 42px padding을 약 28~32px로 낮추고 `.intro` 아래 24px, `.note` 위아래 20px, `.back` 위 28px 등의 간격을 줄인다. 입력 필드·버튼은 현재 최소 48px/52px 높이를 유지한다.
  2. 로그인 방식 선택, 간편 로그인, 간편 가입, Microsoft 로그인 및 오류 메시지가 뜬 상태에서 카드의 첫/마지막 요소가 1440×900 화면 안에 있는지 확인한다. 작은 창에서는 자연 높이와 문서 스크롤을 허용해 내용이나 오류를 자르지 않는다.

### I03. 게임 높이 계산과 세 화면 회귀 검증

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `BASE_FRAME_WIDTH=1250`, `BASE_FRAME_HEIGHT=850`, `useLayoutEffect.measure`, `sceneScale` — 기존 높이 맞춤 검증; read-only, 실제 회귀가 관측될 때만 modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.controlsArea` — 100dvh와 HUD/미로 배치 검증; read-only, 실제 회귀가 관측될 때만 modify
  - `src/App.test.tsx` :: 기존 헤더 내용·인증·게임 진입 검증; read-only, 회귀 때만 modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: 기존 장면 배율 테스트; read-only, 회귀 때만 modify

#### Details

- **Test Scenarios**:
  1. 기존 App 테스트에서 표시 이름과 로그아웃 버튼이 제목이 있는 `header` 안에 있고 버튼은 하나뿐인지 확인한다. CSS만 수정하면 구현을 그대로 따라 쓰는 새 테스트는 추가하지 않는다.
  2. 실제 1440×900에서 로그인 방식 선택·간편 로그인/가입·Microsoft 로그인, 로그인 후 단계 화면, 게임 준비/플레이/일시정지/결과 상태의 `document.documentElement.scrollHeight <= window.innerHeight`와 `scrollWidth <= window.innerWidth`를 확인한다. 각 화면의 마지막 조작 요소가 viewport 안에 있는지도 확인한다.
  3. 게임 배율 `min(areaRect.width / 1250, availableHeight / 850)`와 ResizeObserver/HUD 재측정은 유지한다. 스크롤이 관측되면 `screenRect`, `areaRect`, `controlsRect`, bottom padding 측정 오차를 확인하고 그 경우에만 GameScreen과 해당 테스트를 수정한다. 임의로 미로 기준 크기·게임 좌표·저장 데이터를 바꾸지 않는다.
  4. 모바일·매우 낮은 창에서는 내용 접근용 스크롤을 허용하며 오버플로를 무조건 숨겨 입력·버튼을 자르지 않는다.

## Acceptance Criteria

- [x] 상단 제목·계정 영역에 외곽 카드의 테두리·배경·그림자가 보이지 않고 내용은 유지된다.
- [x] 1440×900에서 로그인 방식 선택·간편/Microsoft 로그인과 게임 준비·플레이·팝업 상태에 문서 세로/가로 스크롤이 없다.
- [x] 입력·오류·HUD·조작·팝업과 작은 화면의 내용 접근이 유지된다. 로그인 카드, 랭킹/단계 패널, 게임 보드의 기존 테두리는 변경하지 않는다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 헤더 내용, 인증, 게임 화면 배율 회귀 검증
- `npm.cmd run lint` — TypeScript 검사 통과
- `npm.cmd run build` — 스타일 포함 빌드 통과
- `git diff --check` — 공백 오류 없음
- 수동 브라우저 확인: 1440×900에서 로그인 방식 선택·간편 로그인/가입·Microsoft 로그인·단계 선택·게임 준비/플레이/일시정지/결과 화면의 문서 스크롤 없음; 320px 모바일에서 입력·버튼 접근 가능; 상단 헤더 박스 없음

## Commit Message

```text
style(layout): fit laptop views and unbox account header

Plan: 2026-10-06-campaign-leaderboard-split
Phase: P01-campaign-layout
Task: T03-header-unbox

- Remove header card frame and compact login card spacing
- Verify existing game viewport scale and preserve controls
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: see `style(layout): fit laptop views and unbox account header`

## Commit Isolation

커밋에는 이 Task에서 실제 수정한 `global.css`, `LoginScreen.module.css`, 필요 시 `responsive.css`/게임 화면 관련 파일·Task 메모만 지정한다. 이미 스테이징된 배포 파일 네 개는 포함하지 않고 커밋 직전 포함 파일 목록을 확인한다.

## After Completion

- 다음 Active Task는 `T04-leaderboard-pagination.md`다. 계획과 Phase는 아직 `in_progress`를 유지한다.
- 마지막 T04가 완료되면 `.memory/current.md`를 `2026-10-02-dual-login-separated-rankings-free-deploy`의 `P03-release/T01-cloudflare-entra-deploy`로 복귀시킨다.
