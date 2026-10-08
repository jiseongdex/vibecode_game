# Decisions: Rank users with no completed stage

- Date: 2026-10-08
- Status: Confirmed

## D01. Include users before their first clear
- **Chosen**: Include accounts with no completed stage in their own login type's leaderboard and show `0단계` with a numeric rank.
- **Rationale**: The request explicitly includes users without records. Existing rankings separate simple and Microsoft accounts.

## D02. Preserve ranking rules
- **Chosen**: Completed stages rank before stage 0. Users tied at stage 0 share the same competition rank, as equal completed-stage/time records already do. Account ID only gives stable display order.
- **Rationale**: Existing ranking uses SQL `RANK()` and the current-user rank counts strictly better users.

## D03. Keep storage semantics
- **Chosen**: Keep both progress fields null until a stage is cleared. Convert null stage to 0 in the leaderboard response and keep best time null.
- **Rationale**: The database constraint permits only completed stages 1–20 with a time; 0 is a presentation value.

## D04. Page size and display
- **Chosen**: Show 10 ranking rows per page with the existing pagination, while keeping the top-100 API limit and pinned own-record row. Show `기록 없음` when a user's best time is null.
- **Rationale**: This incorporates the user's latest page-size request and keeps the established layout.
