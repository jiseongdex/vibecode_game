# Task: T01 내 기록 상단과 10개 순위 자리

## Status: done

## Goal

랭킹 설명 문구를 없애고 로그인 사용자의 기록을 제목 아래에 항상 표시한다. 10개 순위 칸을 기록 수와 관계없이 보여주고 다음 10개는 기존 페이지네이션으로 탐색한다.

## Decision Summary

- D01~D03: 서버의 순서·공동 순위·최대 100명은 유지한다. 페이지 크기 10, 빈 행은 화면 전용이다.
- D02: `current: null`은 기록 없음이다. 이때 표시 이름은 로그인 세션에서 전달한다.
- D05: 배포 설정·API·모바일 탭은 수정하지 않는다.

## Implementation

### I01. 계정 표시 이름 전달

- Related Files:
  - `src/App.tsx` :: `AuthenticatedGame`의 `CampaignWorkspace` props — `account.user.displayName` 전달; modify
  - `src/components/Campaign/CampaignWorkspace.tsx` :: `CampaignWorkspaceProps`, `CampaignWorkspace` — `currentDisplayName`을 받아 `LeaderboardPanel`에 전달; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface CampaignWorkspaceProps {
    authType: AuthType
    currentUserId: string
    currentDisplayName: string
    progress: CampaignProgress
    appearance: PlayerAppearance
    onAppearanceChange: (appearance: PlayerAppearance) => void
    onStartStage: (stage: number) => Promise<void>
    onUnauthorized: () => Promise<void>
  }
  ```
- **Data & Schema Fields**: `SessionDto.user.displayName: string`을 읽기만 한다. `LeaderboardDto = { top: LeaderboardEntry[]; current: LeaderboardEntry | null }`와 API 응답은 그대로 둔다.
- **Execution Flow / Logic**: 인증된 계정의 `id`와 표시 이름을 랭킹 컴포넌트에 함께 전달한다. 로그인 유형 또는 ID가 바뀌면 기존 `identity` 기준 로딩 초기화·페이지 1 복귀를 유지한다.

### I02. 랭킹 고정 칸과 상단 내 기록

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel`, `RankingRow`, `PAGE_SIZE` — 설명 문구 제거, 상단 내 기록, 빈 자리 10개, 페이지네이션; modify
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel`, `.header`, `.list`, `.row`, `.pagination`, `.outsideTop` — 상단 내 기록·10칸 레이아웃 및 모바일 대응; modify

#### Details

- **Signatures & Types**:
  ```typescript
  function LeaderboardPanel(props: {
    authType: AuthType
    currentUserId: string
    currentDisplayName: string
    onUnauthorized: () => Promise<void>
  }): ReactElement
  ```
- **Data & Schema Fields**: `LeaderboardEntry = { rank: number; userId: string; displayName: string; highestStage: number; bestTimeSeconds: number }`. `top`은 최대 100개의 서버 정렬 결과이고 `current`는 완료 기록이 없을 때 `null`이다. 빈 자리는 API DTO가 아니라 표시용 `{slotRank: number}`이다.
- **Execution Flow / Logic**:
  1. `getLeaderboard()` 로딩·오류·401 처리, 재시도, 페이지 초기화는 유지한다.
  2. 헤더의 `전체 기간 · 최고 완료 단계 우선, 같은 단계에서는 최단 시간 우선` 문구만 제거한다. Microsoft 공개 이름 안내는 유지한다.
  3. 준비된 응답에서 `내 기록`을 목록 위에 항상 렌더링한다. `current`가 있으면 실제 `rank/displayName/highestStage/bestTimeSeconds`를 보여준다. `null`이면 순위 없음, 로그인 표시 이름, 기록 없음을 보여준다. 기존 하단 `outsideTop` 블록은 없앤다.
  4. `pageCount = Math.max(1, Math.ceil(top.length / 10))`, `currentPage`는 범위에 제한한다. 페이지별 실제 0~10개를 서버 순서대로 렌더링하고 부족한 위치는 `slotRank = (currentPage - 1) * 10 + slotIndex + 1`의 빈 행으로 채운다. 빈 행의 닉네임·단계·시간은 시각적으로 비우고 `aria-label`에 기록 없음을 알린다. 실제 행의 공동 순위 숫자는 서버 값을 그대로 쓴다.
  5. 목록은 항상 렌더링하고 페이지 버튼·`1/1 페이지`도 기록 0개에서 표시한다. 이전·다음 버튼의 범위 제한을 유지한다. 목록 속 현재 사용자는 계속 강조하되 상단 내 기록은 페이지와 무관하게 남는다.
- **Error & Exception Handling**: 오류·로딩 상태에서는 이전 계정 목록이나 내 기록을 표시하지 않는다. 401은 부모의 인증 새로고침을 호출한다.

### I03. 회귀 테스트

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: `LeaderboardPanel` 테스트 — 내 기록 고정, 빈 순위, 100명 페이지, 공동 순위, 로딩·오류·계정 변경; modify
  - `src/App.test.tsx` :: `App authentication and account game` — 로그인 표시 이름이 `current:null` 랭킹 상단에 보이는지 확인; modify

#### Details

- 현재 7개 랭킹 테스트의 새 필수 prop을 갱신한다. 첫 페이지에 실제 2명만 있어도 목록 10칸이며 닉네임 빈 칸 8개임을 확인한다. 기록 0개도 1~10위, 내 기록 미완료, 1/1 페이지를 확인한다. 100명 중 페이지 2는 서버 공동 순위를 유지하며 상단 내 기록이 남는다. 재시도와 계정 교체 중 이전 데이터 비노출을 확인한다.

## Acceptance Criteria

- [x] 설명 문구가 사라지고 `내 기록`이 순위 목록 위에 항상 있다.
- [x] 기록 0~9명인 1페이지에서 1~10번째 칸이 보이고 빈 칸 닉네임은 비어 있다.
- [x] 11명 이상은 페이지 이동으로 볼 수 있고 공동 순위·상위 100명 한도는 유지된다.
- [x] 401·재시도·계정 전환 시 이전 계정의 이름과 순위가 노출되지 않는다.

## Validation

- `npm.cmd test -- --run src/components/Leaderboard/LeaderboardPanel.test.tsx src/App.test.tsx` — 랭킹·계정 회귀
- `npm.cmd run lint` — 타입 검사
- `npm.cmd run build` — 번들 검사
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(leaderboard): 내 기록을 고정하고 랭킹 열 칸 표시

Plan: 2026-10-08-leaderboard-slots-stage-icon-buttons
Phase: P01-campaign-ui
Task: T01-leaderboard-fixed-slots

- 현재 플레이어 기록을 페이지별 랭킹 위에 고정
- 서버 순위를 바꾸지 않고 빈 순위 칸 표시
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `b3f7482`
