# Decisions: Distinguish own record from ranking list

- Date: 2026-10-08
- Status: Confirmed

## D01. Separate the two reading areas
- **Chosen**: Place `내 기록` in a distinct tinted card with spacing. Give the public list its own `전체 순위` heading, divider, and section. Keep own record pinned above the list and keep 10 ranks per page.
- **Rationale**: The current list begins immediately after the own-record row and has no heading of its own, making the two areas read as one.

## D02. Shorten stage labels
- **Chosen**: Show `{n}단계` in both own record and ranking rows, removing `최고`. Keep the existing rank, name, time, and no-record text.
- **Rationale**: This directly follows the user's label request while preserving the ranking data.

## D03. Smoke accounts
- **Chosen**: Investigate the two named production accounts read-only and report the evidence. Do not delete or edit them as part of the UI change.
- **Rationale**: The user asked whether they were created for verification, not for their removal. They are production accounts and deletion would be irreversible.
