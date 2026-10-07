# Task: T04 랭킹 10명 페이지네이션과 무스크롤 패널

## Status: done

## Goal

기존 상위 100명 랭킹을 한 페이지에 10명씩 보여주고 이전/다음 버튼으로 전환한다. `1440×900px`에서 랭킹 패널과 문서에 스크롤이 생기지 않으며, 현재 사용자 순위를 페이지와 무관하게 찾을 수 있어야 한다.

## Decision Summary

- 결정 D03·D06·D08: `GET /api/leaderboard`는 현재 로그인 유형의 상위 100명과 별도 `current`를 이미 반환한다. 서버 쿼리·정렬·DTO는 변경하지 않고 클라이언트에서 10명 단위로 나눈다.
- 이전 T01은 긴 랭킹 접근을 위해 임시 내부 스크롤을 남겼고 T02는 모바일 탭을 추가했다. 이 Task는 두 화면 크기에서 랭킹 페이지네이션을 완성하고 임시 스크롤을 제거한다.
- 배포 Task의 기존 스테이징 파일 네 개는 커밋에 포함하지 않는다. 완료 후 이전 배포 작업으로 포인터를 돌린다.

## Implementation

### I01. 상위 100명 배열의 클라이언트 페이지 계산

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel`, `RankingRow`, `LoadState` — 페이지 상태·표시 목록·조작 버튼; modify
  - `src/api/contracts.ts` :: `LeaderboardDto`, `LeaderboardEntry` — 기존 DTO 확인만; read-only
  - `src/api/client.ts` :: `getLeaderboard()` — 기존 단일 요청 확인만; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  const PAGE_SIZE = 10
  const [page, setPage] = useState<number>(1)
  // data: LeaderboardDto | null
  const pageCount = data ? Math.ceil(data.top.length / PAGE_SIZE) : 0
  const visibleEntries = data?.top.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? []
  const currentOnPage = visibleEntries.some((entry) => entry.userId === currentUserId)
  ```
- **Data & Schema Fields**:
  - `LeaderboardDto = { top: LeaderboardEntry[]; current: LeaderboardEntry | null }`; `LeaderboardEntry = { rank: number; userId: string; displayName: string; highestStage: number; bestTimeSeconds: number }`. 원본 `top` 순서·공동 순위 값과 `current`는 수정하지 않는다. `page: number`는 기본 1의 컴포넌트 일시 상태이며 서버·localStorage에 저장하지 않는다.
- **Execution Flow / Logic**:
  1. `getLeaderboard()` 성공 시 기존 응답을 저장하고 페이지를 1로 초기화한다. 인증 유형/사용자 변경과 오류 후 재시도에도 1페이지에서 시작한다. 비동기 응답 경합을 막는 기존 `active` cleanup과 401 처리·재시도를 유지한다.
  2. `data.top`의 길이로 실제 페이지 수를 계산한다. 빈 배열이면 빈 상태만 표시하고 페이지 조작은 숨긴다. 데이터가 1~10명이면 한 페이지, 100명이면 10페이지다. 페이지 번호는 `1 <= page <= max(1,pageCount)` 범위에 둔다.
  3. 기존 `<ol aria-label="상위 100명 랭킹">`에 `visibleEntries`만 렌더링한다. 각 `RankingRow`의 `entry.rank`는 서버 값 그대로 표시해 공동 순위/전체 순위를 페이지마다 다시 매기지 않는다. 목록 위·아래 문구는 필요하면 `상위 100명 중 1–10명`처럼 현재 범위를 보여준다.
  4. 목록 아래에 `이전 페이지`, `다음 페이지` 네이티브 버튼과 `현재/전체 페이지` 표시를 둔다. 첫/마지막 페이지 버튼은 `disabled`다. 클릭은 `setPage`만 호출하고 API를 다시 요청하지 않는다. 페이지 이동 후 랭킹 제목·안내·현재 사용자 요약은 유지한다.
  5. `data.current !== null`이고 `currentOnPage`가 false이면 `내 순위` 요약에 `RankingRow`를 한 번 더 표시한다. 따라서 현재 사용자가 상위 100명 밖이거나 현재 페이지 바깥에 있어도 자신의 순위를 볼 수 있다. 현재 페이지에 본인 행이 있으면 중복 요약을 숨긴다. `current === null`이면 기존 미순위 안내를 보인다.

### I02. 1440×900 랭킹 패널 높이와 모바일 표시

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel`, `.header`, `.list`, `.row`, `.outsideTop`, 새 페이지 조작 클래스 — 10행과 현재 사용자 요약을 노트북 높이에 맞춤; modify
  - `src/components/Campaign/CampaignWorkspace.module.css` :: `.leaderboardPane` — T01/T02 임시 랭킹 내부 스크롤 제거; modify
  - `src/components/Campaign/CampaignScreen.module.css` :: `.campaign`, `.grid` — 범위 외; read-only

#### Details

- **Signatures & Types**: CSS에 저장 모델·함수 타입 추가 없음. 페이지 조작 버튼은 `type="button"`과 명확한 이름을 사용한다.
- **Data & Schema Fields**: 새 서버 필드 없음. 높이는 브라우저의 기존 `data-campaign-active` flex 작업 공간 안에서 배분한다.
- **Execution Flow / Logic**:
  1. 900px 초과 반폭 패널에서 `.row`를 가능하면 한 줄로 배치한다. 순위·이름·최고 단계·최단 시간·내 기록 배지를 유지하고 이름은 `min-width:0` 및 긴 텍스트 줄바꿈/말줄임을 적용한다. 행 최소 조작 높이 대상은 아니라도 10행, 제목, Microsoft 실명 안내, 페이지 조작, 내 순위 요약이 `1440×900` 패널 높이에 들어오도록 행 padding·font·gap과 패널 padding을 압축한다.
  2. `.leaderboardPane`의 데스크톱 `overflow-y:auto`와 T02 모바일 `max-height/overflow-y:auto`를 제거한다. 1440×900에서는 `scrollHeight <= clientHeight`여야 한다. 모바일은 한 페이지 10명만 보여 주고 화면이 낮으면 문서 스크롤로 모든 행과 페이지 버튼에 접근할 수 있어야 한다.
  3. 320px 등 좁은 폭에서는 기존 `.row` 다중 행 CSS를 유지해 이름·시간이 겹치지 않게 한다. 페이지 조작 버튼은 줄바꿈 가능하게 하고 `disabled`와 `:focus-visible` 상태를 구분한다.

### I03. 페이지 이동·계정 전환·오류 회귀 테스트

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: `LeaderboardPanel` — 페이지 경계, 순위 보존, 내 순위·재시도; modify
  - `src/App.test.tsx` :: `App authentication and account game` — 같은 페이지에서 단계 버튼과 랭킹 페이지 조작 공존; modify-if-needed

#### Details

- **Test Scenarios**:
  1. 100개 응답에서 첫 페이지 목록은 10개, `다음 페이지` 클릭 시 11~20번째 원본 항목, 마지막 10페이지는 91~100번째 항목이다. 서버 `rank`가 공동 순위여도 그대로 표시한다. 페이지 버튼으로 API 추가 호출은 없다.
  2. 첫 페이지의 `이전 페이지`와 마지막 페이지의 `다음 페이지`는 disabled다. 빈 배열이면 페이지 버튼이 없고 기존 빈 결과 문구가 있다. 1~10개면 페이지 수 1이다.
  3. 현재 사용자가 다른 페이지의 상위 100명에 있거나 101위인 경우 `내 순위` 요약에서 보이고, 현재 페이지에 들어오면 중복 요약이 사라진다. `current:null`은 미순위 안내가 보인다.
  4. 503 오류·재시도, 401 만료, `authType`/`currentUserId` 교체 시 이전 사용자 목록이 잠시 보이지 않고 페이지가 1로 돌아간다. T01의 인증 유형별 랭킹과 T02의 모바일 탭 전환 동작을 유지한다.
  5. JSDOM 테스트는 목록과 조작 상태를 검증하고 실제 높이는 브라우저에서 확인한다. 1440×900에서 랭킹·단계 패널 및 문서의 `scrollHeight <= clientHeight`를 확인한다. Microsoft 실명 안내와 내 순위가 동시에 있어도 넘치지 않아야 한다.

## Acceptance Criteria

- [x] 상위 100명을 한 번 조회해 페이지당 최대 10명씩 표시하고 이전/다음 버튼으로 이동한다.
- [x] 공동 순위·계정 유형 분리·현재 사용자 요약·빈 결과·오류·401 처리가 유지된다.
- [x] 1440×900에서 문서, 단계 패널, 랭킹 패널 모두 세로/가로 스크롤 없이 내용과 페이지 버튼이 보인다.
- [x] 모바일에서는 랭킹 탭의 페이지 버튼과 모든 행에 접근할 수 있고 불필요한 내부 스크롤이 없다.

## Validation

- `npm.cmd test -- --run src/components/Leaderboard/LeaderboardPanel.test.tsx src/App.test.tsx` — 페이지 경계·순위·인증/오류 회귀 검증
- `npm.cmd test -- --run` — 전체 클라이언트·Worker 회귀 통과
- `npm.cmd run lint` — TypeScript 검사 통과
- `npm.cmd run build` — 배포 자산 빌드 통과
- `git diff --check` — 공백 오류 없음
- 수동 브라우저 확인: 1440×900에서 세 화면 문서 스크롤, 단계/랭킹 내부 스크롤 없음; 랭킹 첫/중간/마지막 페이지와 내 순위; 320px 모바일 탭·페이지 버튼 접근 가능

## Commit Message

```text
feat(leaderboard): paginate ranking within laptop view

Plan: 2026-10-06-campaign-leaderboard-split
Phase: P01-campaign-layout
Task: T04-leaderboard-pagination

- Show ten ranked players per page without refetching
- Keep own rank visible and remove ranking pane scrolling
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: see `feat(leaderboard): paginate ranking within laptop view`

## Commit Isolation

커밋에는 이 Task의 `LeaderboardPanel` 코드·스타일·테스트, `CampaignWorkspace.module.css`, 실제 수정한 `App.test.tsx`, Task 메모만 지정한다. 이미 스테이징된 배포 파일 네 개는 포함하지 않는다. 새 `.memory` 파일은 필요한 경로만 `git add -f`로 추가하고 커밋 직전 포함 파일 목록을 확인한다.

## After Completion

- 이 계획과 Phase를 `done`으로 갱신한다.
- `.memory/current.md`의 Active Plan/Phase/Task를 기존 `2026-10-02-dual-login-separated-rankings-free-deploy/P03-release/T01-cloudflare-entra-deploy`로 복귀시킨다. Microsoft Entra 앱 등록과 실제 로그인 검증은 완료로 표시하지 않는다.
