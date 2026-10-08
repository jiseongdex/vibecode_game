# Task: T01 20칸 랭킹·행 간격·중앙 타이틀

## Status: done

## Goal

상위 랭킹을 한 페이지 20칸으로 표시하고 행 간격을 넓힌다. 데스크톱에서 게임 타이틀이 화면 가운데에 오며 계정 조작은 오른쪽에 남는다.

## Decision Summary

- D01: `PAGE_SIZE=20`, 기존 API 응답 100명·공동 순위 유지, 부족한 칸은 화면 전용 빈 행.
- D02: 넓은 화면의 랭킹 목록만 스크롤, 내 기록과 페이지 이동은 고정. 낮은 화면·모바일은 문서 스크롤.
- D03: 데스크톱 헤더 3열 그리드 중앙에 제목·안내, 오른쪽에 계정 조작. 모바일 세로 배치 유지.
- D04: 기존 배포 파일·API·단계 선택은 수정하지 않는다.

## Implementation

### I01. 랭킹 20칸과 목록 스크롤

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `PAGE_SIZE`, `LeaderboardPanel` — 페이지 크기 20, 페이지 수·슬라이스·빈 행 번호 자동 계산 유지; modify
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel`, `.list`, `.row`, `.pagination`, 모바일·짧은 화면 미디어 쿼리 — 행 간격·여백 확대와 목록 내부 스크롤; modify

#### Details

- **Signatures & Types**:
  ```typescript
  const PAGE_SIZE = 20
  function LeaderboardPanel(props: {
    authType: AuthType
    currentUserId: string
    currentDisplayName: string
    onUnauthorized: () => Promise<void>
  }): ReactElement
  ```
- **Data & Schema Fields**: `LeaderboardDto = { top: LeaderboardEntry[]; current: LeaderboardEntry | null }`, `LeaderboardEntry = { rank: number; userId: string; displayName: string; highestStage: number; bestTimeSeconds: number }`. DTO·서버 최대 100명 불변. `EmptyRankingRow.rank`는 표시용 위치 번호다.
- **Execution Flow / Logic**:
  1. `pageCount = Math.max(1, Math.ceil(data.top.length / 20))`; 페이지 1에 0~20위, 페이지 2에 21~40위 등의 화면 자리를 렌더링한다. 실제 공동 순위는 `entry.rank`를 그대로 사용한다.
  2. `<ol aria-label="상위 100명 랭킹">`에 별도 CSS class를 지정해 높이가 제한된 데스크톱 패널의 남은 공간을 차지하고 `overflow-y:auto`로 내부 스크롤한다. 제목·내 기록·페이지 버튼은 스크롤 밖에 둔다. 페이지 이동 시 새 페이지 첫 행으로 목록의 scrollTop을 되돌린다.
  3. 행 `gap`과 `padding`을 확대한다. 가로 폭이 좁아도 이름 생략·모바일 줄바꿈 규칙을 유지한다. 넓은 화면의 `.panel`은 높이 100% flex column/min-height 0으로 스크롤 영역을 제한한다.
  4. `(max-width:900px), (max-height:650px)`에서는 패널·목록의 고정 높이·내부 스크롤을 해제해 기존 문서 스크롤을 사용한다. 모바일 탭 표시 규칙은 그대로 둔다.
- **Error & Exception Handling**: 로딩·오류·401 처리와 내 기록 상단은 그대로 유지한다. 페이지 전환 중 API 재요청은 하지 않는다.

### I02. 중앙 타이틀

- Related Files:
  - `src/styles/global.css` :: `body > #root > main > header`, `.header-title`, `h1`, `.account-toolbar`, 900px 이하 미디어 규칙 — 3열 중앙 정렬; modify
  - `src/App.tsx` :: `AuthenticatedGame` 헤더 — 기존 제목 묶음과 계정 묶음 구조 확인; read-only

#### Details

- **Execution Flow / Logic**: 901px 이상은 `grid-template-columns: minmax(0,1fr) auto minmax(0,1fr)`로 좌우 같은 공간을 만들고 `.header-title`을 2열에, `.account-toolbar`를 3열 오른쪽에 둔다. 제목·안내의 text-align과 h1 정렬을 center로 한다. 900px 이하는 flex column으로 전환해 기존 모바일 폭·버튼 접근성을 유지한다. 헤더의 사각 테두리는 만들지 않는다.

### I03. 회귀 테스트와 화면 확인

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: `LeaderboardPanel` 테스트 — 0명 1~20위, 21명/100명 페이지 이동, 내 기록 유지·빈 이름·공동 순위; modify
  - `src/App.test.tsx` :: `App authentication and account game` — 중앙 제목 묶음과 계정 묶음 구조 및 20칸 통합 확인; modify-if-needed

#### Details

- 0명·2명·21명·100명 응답에서 페이지 수와 20개 행, 빈 닉네임을 확인한다. 공동 순위는 서버 값을 유지한다. 페이지 이동 후 목록 scrollTop 복귀를 검증한다. 1440×900에서 문서 스크롤 없이 목록만 스크롤되고 타이틀 중심 x가 화면 중심 x와 일치하는지 브라우저로 측정한다. 1213×600의 좌우 패널, 320px 모바일 탭·가로 무스크롤을 확인한다.

## Acceptance Criteria

- [x] 랭킹은 20칸/페이지이고 행 간격이 넓어졌다. 기록이 없어도 1~20위와 빈 닉네임이 보인다.
- [x] 21명 이상은 다음 페이지에서 21위부터 볼 수 있고 내 기록은 계속 상단에 있다.
- [x] 1440×900에서 문서 스크롤 없이 랭킹 목록만 스크롤되고 페이지 조작에 접근할 수 있다.
- [x] 게임 제목 중심은 데스크톱 화면 중심에 있으며 닉네임·로그아웃은 오른쪽에 있다.
- [x] 낮은 데스크톱 좌우 배치와 모바일 탭·가로 무스크롤을 유지한다.

## Validation

- `npm.cmd test -- --run src/components/Leaderboard/LeaderboardPanel.test.tsx src/App.test.tsx` — 랭킹·헤더 회귀
- `npm.cmd run lint` — 타입 검사
- `npm.cmd run build` — CSS 포함 번들 검사
- `git diff --check` — 공백 오류 없음
- 실제 브라우저 1440×900, 1213×600, 320px — 제목 중심, 내부/문서 스크롤, 20칸·페이지 이동 확인

## Commit Message

```text
style(campaign): show twenty ranks and center game title

Plan: 2026-10-08-leaderboard-20-centered-title
Phase: P01-layout
Task: T01-rank-list-header

- Expand ranked pages to twenty spaced rows with list scrolling
- Center the game title independently of account controls
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
