# Plan: Rank users with no completed stage

## Goal

Every registered user appears in the leaderboard for their login type, including accounts with no completed stage. Such accounts show stage 0 and a numeric rank. Each ranking page shows positions for 10 users.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | Update leaderboard query, contract, 10-row display, and regression tests | [P01](../phases/2026-10-08-rank-zero-stage-users/P01-leaderboard/phase.md) |

## Resumption

After T01, return `.memory/current.md` to the preexisting [deployment task](../phases/2026-10-02-dual-login-separated-rankings-free-deploy/P03-release/T01-cloudflare-entra-deploy.md). Preserve already staged deployment files and their separate commit scope.
