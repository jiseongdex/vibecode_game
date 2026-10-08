# Task: T01 제목 행·진행 요약·데스크톱 열 배치

## Status: done

## Goal

로그인한 단계 선택 화면에서 제목·닉네임·로그아웃을 같은 데스크톱 행에 놓고 `완료 N/20단계 · 해금 N/20단계` 문구를 삭제한다. 901px 이상에서는 높이가 낮아도 랭킹 왼쪽·단계 오른쪽 배치를 지킨다.

## Decision Summary

- D01·D02: 기존 제목·안내·계정 동작과 단계 해금 데이터는 유지하며 화면 구조와 요약 문구만 바꾼다. 900px 이하에서는 헤더 묶음을 세로로 내려 내용 접근을 보장한다.
- D03: 900px 이하에만 모바일 탭·세로 패널 배치를 적용한다. 901px 이상 낮은 화면에는 문서 스크롤을 허용하지만 열 순서는 바꾸지 않는다.
- D04: 배포 Task 스테이징 파일은 커밋에서 제외한다.

## Implementation

### I01. 상단 제목·계정 행

- Related Files:
  - `src/App.tsx` :: `AuthenticatedGame`의 `<header>` — `<h1>`과 안내 `<p>`를 제목 묶음으로 감싸고 기존 `.account-toolbar`를 형제로 유지; modify
  - `src/styles/global.css` :: `body > #root > main > header`, `.account-toolbar` — 데스크톱 flex 한 행, 왼쪽 제목 묶음/오른쪽 계정 묶음, 타이틀 왼쪽 정렬과 계정 오른쪽 정렬; modify
  - `src/styles/responsive.css` :: 기존 600px 이하 헤더 규칙 — 좁은 화면의 안내 문구 크기·버튼 접근 보장; modify-if-needed

#### Details

- **Signatures & Types**: `AuthenticatedGame`의 `account: SessionDto`, `onSignOut: () => Promise<void>` 및 기존 JSX 버튼 콜백 타입은 그대로 둔다. 새 API·상태는 없다.
- **Data & Schema Fields**: `account.user.displayName: string`; 사용자 정보 필드·저장 모델 변경 없음.
- **Execution Flow / Logic**:
  1. `!session`일 때만 렌더링되는 헤더 조건을 유지한다.
  2. `<div className="header-title">` 안에 기존 `<h1>`과 안내 `<p>`를 넣고 `.account-toolbar`를 옆 형제로 둔다. 텍스트와 로그아웃 버튼 콜백은 유지한다.
  3. 데스크톱 헤더를 `display:flex; align-items:center; justify-content:space-between`으로 배치하고 제목 묶음에 `min-width:0`, 계정 도구에 `flex:none`을 적용한다. 900px 이하에서는 헤더 `flex-direction:column`으로 줄바꿈해 가로 넘침을 막는다.
  4. 제목·계정의 테두리 없는 외관, 계정 버튼 초점 표시, 1440×900 높이를 유지한다.

### I02. 진행 요약과 잘못된 세로 전환 제거

- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreen` — `completedCount` 계산과 `.progress` 문구 제거, `campaignComplete`와 각 단계의 `record`/`unlockedStage` 사용 유지; modify
  - `src/components/Campaign/CampaignScreen.module.css` :: `.progress` 선택자 — 미사용 스타일 제거, `.pickerLabel` 스타일과 5열·2열 경로 유지; modify
  - `src/components/Campaign/CampaignWorkspace.module.css` :: `.workspace`, `.pane` — `(max-height: 650px)`와 묶인 세로 전환을 폭 900px 이하 전용으로 바꾸고, 901px 이상 낮은 화면은 2열 유지·자연 높이로 접근; modify
  - `src/styles/global.css` :: `main[data-campaign-active='true']` 낮은 화면 규칙 — 901px 이상 높이 650px 이하에서 문서 스크롤을 허용; modify-if-needed

#### Details

- **Signatures & Types**: `CampaignScreenProps`와 `CampaignProgress = { unlockedStage: number; stageRecords: Record<number, { bestTimeSeconds: number }> }`를 유지한다. `CampaignWorkspaceProps`와 `CampaignTab = 'stages' | 'leaderboard'`도 유지한다.
- **Data & Schema Fields**: 진행 DTO·랭킹 DTO·저장 구조 변경 없음. 요약 문구만 삭제한다.
- **Execution Flow / Logic**:
  1. `campaignComplete = Boolean(progress.stageRecords[MAX_STAGE])`와 각 카드의 잠금·최고 시간 표시는 유지한다.
  2. `.workspace`의 1:1 그리드는 901px 이상에서 고정하고, 세로 전환·order는 `@media (max-width:900px)`로만 적용한다. 기존 탭 숨김과 패널 표시 규칙도 같은 폭 기준을 유지한다.
  3. 901px 이상·650px 이하에는 `height:auto`, `overflow:visible` 등으로 문서 흐름을 열고 패널 높이를 내용에 맞춰 단계 버튼·랭킹 행이 잘리지 않게 한다. 1440×900의 100dvh 무스크롤 동작은 유지한다.

### I03. 회귀 검증

- Related Files:
  - `src/App.test.tsx` :: `App authentication and account game` — 제목·닉네임·로그아웃 동일 헤더 유지, 제목 묶음과 단계·랭킹 순서 검증; modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: `CampaignScreen` — 요약 문구 부재와 기존 해금·완료 동작 검증; modify

#### Details

- 1440×900과 1213×600 브라우저에서 랭킹 패널 x좌표가 단계 패널보다 작고, 1213×600에서는 두 패널 상단 y좌표가 같다. 1440×900에서는 문서·두 패널 스크롤이 없어야 한다.
- 320px에서는 기존 단계 선택 기본 탭·랭킹 탭과 헤더 내용 접근을 확인한다. JSDOM은 실제 CSS 위치를 계산하지 않으므로 DOM·동작 테스트와 브라우저 측정을 함께 사용한다.

## Acceptance Criteria

- [x] 901px 이상에서 제목 묶음과 닉네임·로그아웃이 같은 행이고 제목·계정 내용이 유지된다.
- [x] `완료 N/20단계 · 해금 N/20단계` 영역만 사라지고 단계 잠금·완료·최고 기록은 유지된다.
- [x] 901px 이상 낮은 창에서도 랭킹은 왼쪽, 단계 선택은 오른쪽이다. 900px 이하 모바일 탭은 유지된다.
- [x] 1440×900 무스크롤과 작은 화면 내용 접근이 유지된다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/Campaign/CampaignScreen.test.tsx` — 헤더·단계 동작 회귀
- `npm.cmd run lint` — TypeScript 검사
- `npm.cmd run build` — 스타일 포함 빌드
- `git diff --check` — 공백 오류 없음
- 수동 브라우저 확인: 1440×900, 1213×600, 320px에서 헤더·패널 위치·스크롤·탭 확인

## Commit Message

```text
style(campaign): align account header and desktop columns

Plan: 2026-10-08-campaign-header-row-desktop-columns
Phase: P01-layout
Task: T01-header-progress-columns

- Align title and account controls and remove progress summary
- Keep ranking left of stages in short desktop windows
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
