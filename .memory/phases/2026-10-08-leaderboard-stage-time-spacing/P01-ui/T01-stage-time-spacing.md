# Task: T01 Add space between stage and record text

## Status: done

## Goal

Give the desktop `0단계` and `기록 없음` columns clear separation in both the personal and full ranking rows.

## Implementation

- `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.time` and desktop breakpoint. Add `margin-left: 14px` for widths above 700px; mobile layout remains as before.
- No model, API, data, or ranking behavior changes.

## Validation

- `npm.cmd test -- --run src/components/Leaderboard/LeaderboardPanel.test.tsx`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`
- Inspect desktop and mobile row geometry for the intended gap and no horizontal overflow.

## Commit Message

```text
style(leaderboard): space stage and record columns

Plan: 2026-10-08-leaderboard-stage-time-spacing
Phase: P01-ui
Task: T01-stage-time-spacing

- Add room between stage and record text on desktop
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
