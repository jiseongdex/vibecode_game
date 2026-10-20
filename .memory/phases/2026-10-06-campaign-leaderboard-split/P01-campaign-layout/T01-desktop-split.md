# Task: T01 데스크톱 랭킹·단계 좌우 분할

## Status: done

## Goal

로그인한 사용자의 단계 선택 페이지에서 계정 유형별 랭킹을 왼쪽, 단계 선택을 오른쪽에 동시에 렌더링하고 `랭킹 보기`/돌아가기 전환을 제거한다. `1440×900px`에서 문서 및 오른쪽 단계 패널 스크롤 없이 20개 단계를 5열×4행으로 표시한다. 랭킹의 임시 내부 스크롤은 T04 페이지네이션에서 제거한다.

## Decision Summary

- 결정 D01·D03·D06·D07: 기존 `getLeaderboard()`와 `CampaignProgress`를 재사용한다. 데스크톱 단계 경로는 기존 5열×4행을 유지하며 버튼과 간격을 압축한다. 인증 유형별 랭킹 분리, 단계 해금, 오류·재시도·401 처리 동작은 유지한다.
- 이 Task는 데스크톱 완성 단위다. 900px 이하에서는 두 패널을 세로로 표시해 기능을 유지하며, 다음 T02에서 모바일 탭으로 바꾼다.
- 현재 스테이징된 `.dev.vars.example`, `README.md`, `docs/deployment.md`, `wrangler.jsonc`는 배포 Task의 변경이다. 이 Task 커밋에 포함하지 않는다.

## Implementation

### I01. 두 화면을 담는 작업 공간과 App 연결

- Related Files:
  - `src/components/Campaign/CampaignWorkspace.tsx` :: `CampaignWorkspace`, `CampaignWorkspaceProps` — 랭킹·단계 패널을 좌우 순서로 결합; new
  - `src/components/Campaign/CampaignWorkspace.module.css` :: `.workspace`, `.pane`, `.leaderboardPane`, `.stagesPane` — 1:1 그리드와 노트북 높이 맞춤; new
  - `src/App.tsx` :: `AuthenticatedGame` — `campaignView` 상태 및 랭킹 전용 분기를 없애고 작업 공간을 렌더링; modify
  - `src/styles/global.css` :: `main[data-campaign-active='true']`, 직접 자식 `section` — 로그인 후 선택 화면을 viewport 높이의 flex column으로 제한; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface CampaignWorkspaceProps {
    authType: AuthType
    currentUserId: string
    progress: CampaignProgress
    appearance: PlayerAppearance
    onAppearanceChange: (appearance: PlayerAppearance) => void
    onStartStage: (stage: number) => Promise<void>
    onUnauthorized: () => Promise<void>
  }
  export function CampaignWorkspace(props: CampaignWorkspaceProps): ReactElement
  ```
- **Data & Schema Fields**:
  - `AuthType = 'microsoft' | 'simple'`; `SessionDto.user`의 `id: string`, `authType: AuthType`, `displayName: string`을 그대로 전달한다.
  - `CampaignProgress = { unlockedStage: number; stageRecords: Record<number, { bestTimeSeconds: number }> }`; `usePersistedGame`의 `progress`를 그대로 전달한다. 새 저장 필드·API 요청 형식은 없다.
  - `LeaderboardDto = { top: LeaderboardEntry[]; current: LeaderboardEntry | null }`; 기존 `LeaderboardPanel` 내부에서 조회한다. `LeaderboardEntry` 필드는 `rank`, `userId`, `displayName`, `highestStage`, `bestTimeSeconds`다.
- **Execution Flow / Logic**:
  1. `AuthenticatedGame`에서 `type CampaignView`, `campaignView`/`setCampaignView`, `CampaignScreen`과 `LeaderboardPanel` 직접 import, `onShowLeaderboard`, `onBack`, `onCampaign`/`onDiscardSession`의 뷰 리셋을 제거한다. `<main>`에 세션이 없을 때만 `data-campaign-active="true"`를 설정한다. 게임 세션이 없으면 `CampaignWorkspace` 하나에 `account.user.authType/id`, `progress`, `appearance`, `chooseAppearance`, `startStage`, `onRefreshAuth`를 전달한다.
  2. `CampaignWorkspace`는 DOM 순서상 랭킹 패널, 단계 패널을 각각 `.pane`으로 감싼다. 왼쪽에는 `LeaderboardPanel`, 오른쪽에는 `CampaignScreen`을 한 번씩만 렌더링한다. 각 컴포넌트가 이미 제공하는 제목·section 레이블을 유지한다.
  3. `global.css`에서 `main[data-campaign-active='true']`를 `height: 100dvh; display: flex; flex-direction: column; overflow: hidden`으로, 직접 자식 `section`을 `display: flex; flex-direction: column; flex: 1; min-height: 0`으로 만든다. 헤더·오류/전송 배너는 고정 높이 요소, 작업 공간은 남은 높이를 차지한다. 900px 이하나 높이가 매우 작은 창에서는 `height: auto; min-height: 100dvh; overflow: visible`로 풀어 내용·조작 접근을 보장한다.
  4. `.workspace`는 `width: min(calc(100% - 32px), 1500px)`, `flex: 1; min-height: 0`, 중앙 정렬, 두 개의 `minmax(0, 1fr)` 열과 18px 간격을 사용한다. `.pane`은 `min-width: 0; min-height: 0; height: 100%`다. `.stagesPane`에는 1440×900에서 내부 `overflow-y`를 적용하지 않는다. `.leaderboardPane`은 T04까지 100명 접근을 위해 `overflow-y: auto`를 임시 유지한다. 900px 이하에서는 단계 패널이 위, 랭킹 패널이 아래인 세로 구성으로 되돌리고 높이 제한을 푼다. T02에서 모바일 탭으로 대체한다.
  5. 게임을 시작하면 기존 `session ? <GameScreen ...> : <CampaignWorkspace ...>` 분기에 의해 두 패널이 모두 언마운트된다. 게임에서 돌아올 때 재마운트되어 랭킹을 다시 조회한다. `startRun` 실패는 기존 `startError`/`CampaignScreen` 동작을 유지한다. 401은 기존 `onUnauthorized`가 인증 상태를 갱신한다.

### I02. 좁은 패널에 맞는 기존 컴포넌트 정리

- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreenProps`, `routePosition`, `CampaignScreen` — 랭킹 버튼/콜백 제거, 기존 5열/2열 경로 보존; modify
  - `src/components/Campaign/CampaignScreen.module.css` :: `.campaign`, `.grid`, `.routeNode`, `.stage` — 오른쪽 반폭에서 5열×4행이 들어가는 크기; modify
  - `src/components/Player/PlayerAppearancePicker.module.css` :: `.picker`, `.picker button`, `.picker img` — 단계 카드 위의 탐험가 선택 높이 압축; modify
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel` props/header — 돌아가기 버튼/콜백 제거; modify
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel`, `.header`, `.row`, `.back` — 반폭 랭킹 목록 레이아웃; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface CampaignScreenProps {
    progress: CampaignProgress
    appearance: PlayerAppearance
    onAppearanceChange: (appearance: PlayerAppearance) => void
    onStartStage: (stage: number) => Promise<void>
  }
  type RouteDirection = 'left' | 'right' | 'down' | 'end'
  function routePosition(stage: number, columns: 5 | 2): { row: number; col: number; next: RouteDirection }
  // LeaderboardPanel props: authType: AuthType; currentUserId: string;
  // onUnauthorized: () => Promise<void>; onBack 제거
  ```
- **Data & Schema Fields**:
  - 단계 경로는 `MAX_STAGE = 20`, `progress.stageRecords[stage]` 존재 여부, `progress.unlockedStage`를 그대로 사용한다. 새 모델 필드는 없다.
  - 기존 지그재그 계산을 보존한다. 데스크톱 `columns=5`로 5열×4행, 900px 이하 `columns=2`로 2열×10행이다. `--desktop-row/col`, `--mobile-row/col`, `data-desktop-next`와 `data-mobile-next`는 유지한다. `MAX_STAGE=20`, 잠금·완료 판단 및 `bestTimeSeconds`는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. `CampaignScreen`의 `onShowLeaderboard` props/버튼을 제거한다. 탐험가 선택, 완료/해금 문구, 잠긴 단계의 `disabled`, 시작 중 중복 클릭 차단을 유지한다.
  2. 데스크톱 `.campaign`을 부모 패널의 `width: 100%; height: 100%; margin: 0`, 축소된 padding과 `display:flex; flex-direction:column; min-height:0`으로 설정한다. `.grid`를 `flex:1; min-height:0; grid-template-columns:repeat(5,minmax(0,1fr)); grid-template-rows:repeat(4,minmax(44px,1fr))`로, column/row gap을 약 6~8px로 줄인다. `.stage` padding과 글자·아이콘을 줄이되 최소 조작 높이 44px, 잠금/완료/최고 시간 텍스트를 유지한다. 제목·소개·진행률·탐험가 선택 위아래 margin/폰트도 압축하고 `PlayerAppearancePicker` 버튼을 약 48px 높이로 줄인다. 900px 이하에서는 기존 2열 경로와 자연 높이/페이지 스크롤을 복원한다. 연결선이 버튼 위를 가리지 않게 z-index와 데이터 속성을 유지한다.
  3. 랭킹 루트 `.panel`의 고정 1020px 너비/외부 margin을 `width:100%; margin:0`으로 바꾸고 부모 패널에 맞춘다. T04 전까지 랭킹 목록은 임시 내부 스크롤을 허용한다.
  4. `LeaderboardPanel`의 `onBack`과 돌아가기 버튼, 죽은 `.back` CSS를 제거한다. 제목, Microsoft 실명 안내, 로딩·빈 결과·오류·재시도·내 순위는 유지한다. `.row`는 반폭에서 순위/이름/최고 단계/최단 시간이 넘치지 않도록 최대 3열·2행의 컴팩트 배치로 바꾸고 360px 이하 줄바꿈 규칙을 유지한다.
  5. `getLeaderboard()`는 작업 공간 마운트 시 한 번 조회되고 재시도 때만 다시 호출된다. `authType`/`currentUserId` 변경 시 기존 effect가 로딩으로 초기화하는 동작을 유지한다.

### I03. 기존 동작과 새 배치를 검증하는 테스트 갱신

- Related Files:
  - `src/App.test.tsx` :: `App authentication and account game` — 동시 렌더링/세션 재조회/401/게임 시작 회귀; modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: `CampaignScreen` — 기존 5열/2열 지그재그 및 단계 잠금·재플레이; modify
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: `LeaderboardPanel` — 돌아가기 버튼 제거 후 기존 랭킹 상태 검증; modify

#### Details

- **Test Scenarios**:
  1. `/simple` 로그인 시 `단계 선택`과 `간편 계정 랭킹` 제목이 동시에 있고 현재 계정 순위가 표시되며 `랭킹 보기`/`단계 선택으로 돌아가기` 버튼이 없다. `getLeaderboard()`는 최초 한 번만 호출된다.
  2. `/microsoft`는 `Microsoft 랭킹`과 실명 안내를 같은 화면에 표시한다. 인증 불일치 경로 및 익명 사용자는 두 패널을 렌더링하지 않는다. 랭킹 401에서 기존 인증 게이트로 돌아간다.
  3. 게임 시작 시 두 패널이 사라지고 게임에서 단계 선택으로 돌아오면 작업 공간이 재마운트되어 랭킹을 다시 가져온다. `startRun` 실패 시 단계 선택과 랭킹이 모두 유지되고 기존 오류가 뜬다.
  4. 단계 1/5/6/10/20의 기존 `--desktop-col`·`data-desktop-next`, 단계 1/2/3/4/20의 `--mobile-col`·`data-mobile-next`를 유지한다. 단계 잠금/재플레이/최고 시간 테스트를 보존하고 `onShowLeaderboard` fixture와 클릭 기대값만 삭제한다. 1440×900의 실제 높이와 스크롤은 브라우저에서 확인한다.
  5. 랭킹 100명·공동 순위·상위권 밖 내 순위·빈 결과·재시도·401 테스트는 유지하고 돌아가기 콜백 fixture/기대값만 삭제한다.

## Acceptance Criteria

- [ ] 1440×900에서 랭킹 왼쪽·단계 선택 오른쪽, 동일 폭이고 문서 및 단계 패널 스크롤 없이 20개 단계가 5열×4행으로 모두 보인다. 랭킹은 T04 전까지 임시 내부 스크롤로 접근 가능하다.
- [ ] 기존 랭킹 전환 버튼·돌아가기 버튼이 없다. 로그인 유형별 랭킹, 개인정보 안내, 단계 시작·잠금·재플레이가 유지된다.
- [ ] 게임 진입/복귀와 랭킹 오류·재시도·401 회귀 테스트가 통과한다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/Campaign/CampaignScreen.test.tsx src/components/Leaderboard/LeaderboardPanel.test.tsx` — 관련 테스트 통과
- `npm.cmd run lint` — TypeScript 검사 통과
- `npm.cmd run build` — 배포 자산 빌드 통과
- `git diff --check` — 공백 오류 없음
- 수동 브라우저 확인: 1440×900에서 `document.documentElement.scrollHeight <= window.innerHeight`, 단계 패널 `scrollHeight <= clientHeight`, 단계 1~20의 표시·클릭·잠금 상태 — CSS 실제 배치 확인

## Commit Message

```text
feat(campaign): 단계 선택 옆에 랭킹 배치

Plan: 2026-10-06-campaign-leaderboard-split
Phase: P01-campaign-layout
Task: T01-desktop-split

- 데스크톱에서 계정 랭킹과 스크롤 없는 단계 목록을 같은 너비로 배치
- 별도 랭킹 이동 메뉴를 제거하고 게임 화면 전환 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: see `feat(campaign): place ranking beside stage selection`

## Commit Isolation

`.memory/`의 새 계획·Phase·Task는 ignore 대상이므로 이 Task에서 필요한 메모 경로만 `git add -f`로 명시한다. 커밋에는 이 Task의 소스·테스트·메모 경로만 지정하고 이미 스테이징된 배포 파일 네 개는 포함하지 않는다. 커밋 직전 포함 파일 목록을 확인한다.
