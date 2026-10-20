# Task: T01 Rank stage-zero users and show 10 per page

## Status: done

## Goal

Include every registered user in their login type's leaderboard. For users with no completed stage, show nickname, numeric rank, stage 0, and no best time in the list and pinned record. Display 10 ranking positions per page.

## Decision Summary

- Keep login types separate and preserve competition ranks (`RANK()`), including tied stage-zero users.
- Keep the database's null progress fields; expose stage 0 and null best time only through the leaderboard API.
- Preserve the top-100 API limit and change UI pages from 20 to 10 positions.

## Implementation

### I01. API contract and Worker ranking

- Related Files:
  - `src/api/contracts.ts` :: `LeaderboardEntry` — change `bestTimeSeconds` from `number` to `number | null`; modify.
  - `worker/game/leaderboard.ts` :: `RankedUserRow`, `entry`, `getCurrentRank`, `getLeaderboard` — include accounts with null progress and rank them; modify.
  - `migrations/0001_initial.sql` :: `users` progress fields and leaderboard index — read only, no migration.

#### Details

- **Signatures & Types**: `LeaderboardEntry` remains `{rank:number,userId:string,displayName:string,highestStage:number,bestTimeSeconds:number|null}`. `RankedUserRow.highest_completed_stage` is a response number from `COALESCE(..., 0)`; `highest_stage_best_time_seconds` is `number|null`.
- **Data & Schema Fields**: `users.highest_completed_stage` and `users.highest_stage_best_time_seconds` remain `NULL` for never-cleared accounts. Do not persist 0 in `users` because the existing check constraint permits completed stages 1–20 only.
- **Execution Flow / Logic**:
  1. Preserve session validation in the API route; rank only the principal's `auth_type`.
  2. `getLeaderboard` selects all users of that type, projecting `COALESCE(highest_completed_stage, 0) AS highest_completed_stage`. Keep `RANK() OVER (ORDER BY highest_completed_stage DESC, highest_stage_best_time_seconds ASC)` and deterministic `id ASC` display tiebreaker. Remove the `IS NOT NULL` filter. SQLite descending order puts null stages after completed stages.
  3. `getCurrentRank` also projects stage 0 and removes the null-stage filter. Its better-user count must include completed users when current stage is null. Use `COALESCE(better.highest_completed_stage, 0) > COALESCE(u.highest_completed_stage, 0)` for stage comparison, retaining same-stage faster-time comparison. Tied zero-stage accounts receive the same rank.
  4. Map null best time directly into the DTO. Keep `current` nullable only for a missing/mismatched principal row; a valid newly created account gets its stage-zero entry. No data write or schema change.

### I02. Frontend display

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `PAGE_SIZE`, `RankingRow` — set 10 rows per page and render `기록 없음` when `bestTimeSeconds` is null; modify.

#### Details

- Keep `rank` and `최고 {highestStage}단계` rendered for stage-zero entries. Call `formatTime` only when best time is a number. Preserve pinned `내 기록`, empty rank-number placeholders, pagination, and the defensive fallback for an absent `current` response.

### I03. Regression coverage

- Related Files:
  - `worker/game/leaderboard.test.ts` :: session/no-clear test and zero-stage tie cases — modify.
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: row count, pagination, and stage-zero rendering — modify.

#### Details

- Assert unauthenticated requests remain 401, new simple accounts follow completed accounts at rank 2 with stage 0 and null best time, and a new Microsoft account is rank 1 in its separate list. Add a second no-clear simple account and verify both tie at rank 2.
- In UI tests, assert exactly 10 rows/page, positions 11–20 on page 2, and stage-zero DTOs show numeric rank, `최고 0단계`, and `기록 없음` in both list and own-record rows.

## Acceptance Criteria

- [ ] A logged-in user with no clears receives `current.rank` and `current.highestStage: 0`.
- [ ] Their account appears in the top list with nickname and rank; completed users sort first and zero-stage ties share rank.
- [ ] Each ranking page shows 10 rows, and 11th onward appear through pagination.
- [ ] The list and `내 기록` show stage 0 and no best-time value; auth type separation and existing ranks still work.
- [ ] No migration or write of stage 0 to the database is introduced.

## Validation

- `npm.cmd test -- --run worker/game/leaderboard.test.ts src/components/Leaderboard/LeaderboardPanel.test.tsx src/App.test.tsx` — focused API/UI regression.
- `npm.cmd run lint` — type check.
- `npm.cmd run build` — production bundle.
- `git diff --check` — whitespace check.

## Commit Message

```text
feat(leaderboard): 0단계 사용자도 랭킹에 포함하고 열 줄씩 표시

Plan: 2026-10-08-rank-zero-stage-users
Phase: P01-leaderboard
Task: T01-rank-stage-zero-users

- 로그인 유형별 랭킹에 0단계 사용자 포함
- 페이지당 숫자 순위 10개 표시
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `08ab51f`
