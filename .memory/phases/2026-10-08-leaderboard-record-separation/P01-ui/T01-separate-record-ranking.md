# Task: T01 Separate own record and ranking list

## Status: done

## Goal

Give the pinned personal record its own clear visual card and give the public list a labeled section below it. Show stage numbers without the `최고` prefix in every populated leaderboard row.

## Decision Summary

- Keep the API, competition ranks, pinned record, top-100 list, and 10-row pagination unchanged.
- The named Smoke accounts are production data; investigate read-only and report separately without a database mutation.

## Implementation

### I01. Semantic and visual separation

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel` — render a labeled own-record section and separate labeled ranking section; modify.
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.myRecord`, new ranking section/heading rules, responsive rules — modify.

#### Details

- **Signatures & Types**: Keep `LeaderboardPanel` props and `LeaderboardDto` unchanged. No new model or API fields.
- **Data & Schema Fields**: No database changes. `data.current` continues to drive the pinned row, `data.top` drives the rank list.
- **Execution Flow / Logic**:
  1. Render the existing `내 기록` heading and row inside a nested `<section>` labeled by the heading. Give this area a lightly tinted background, border, radius, and padding. Keep enough space after it to distinguish the following list.
  2. Render a sibling `<section>` with a visible `전체 순위` heading, divider, rank `<ol>`, and pagination. Preserve the list's existing accessible name `상위 100명 랭킹`, keyboard focus, loading/error states, page switching, and scroll reset.
  3. Keep desktop height behavior: the ranking section is a flex column with `min-height:0` and the list flexes within it; at `max-width:900px` or `max-height:650px`, remove fixed-height scrolling as the current responsive rule does.
  4. Ensure mobile row grid and headings remain readable at 320px.

### I02. Stage label

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `RankingRow` — change `최고 {entry.highestStage}단계` to `{entry.highestStage}단계`; modify.

#### Details

- Apply to both pinned and public rows through the shared component. Keep `기록 없음` for stage zero/null best time and `최단 mm:ss` for recorded times. Empty placeholder rows stay blank except rank.

### I03. Focused coverage

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: heading/section and stage text assertions — modify.
  - `src/App.test.tsx` :: any integrated stage text assertion affected by the label — modify if needed.

#### Details

- Assert `내 기록` and `전체 순위` are separate named regions in a loaded leaderboard.
- Assert populated rows show `{n}단계` and never `최고`, including a stage-zero account.
- Preserve ranking/page behavior tests and the established loading/empty states.

## Acceptance Criteria

- [ ] Personal record is visibly separated from and labeled independently of the public ranking.
- [ ] Public ranking has a visible `전체 순위` heading; 10 rows/page and pagination still work.
- [ ] No populated leaderboard row contains `최고`; stage number, rank, and time remain visible.
- [ ] No production user data is edited by this task.

## Validation

- `npm.cmd test -- --run src/components/Leaderboard/LeaderboardPanel.test.tsx src/App.test.tsx` — focused UI/integration coverage.
- `npm.cmd test -- --run` — full regression.
- `npm.cmd run lint` — type check.
- `npm.cmd run build` — production bundle.
- `git diff --check` — whitespace check.

## Commit Message

```text
feat(leaderboard): 개인 기록과 전체 랭킹 분리

Plan: 2026-10-08-leaderboard-record-separation
Phase: P01-ui
Task: T01-separate-record-ranking

- 개인 기록과 공개 랭킹 영역 구분
- 단계 숫자 앞의 최고 표시 제거
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `b3dc1e3`
