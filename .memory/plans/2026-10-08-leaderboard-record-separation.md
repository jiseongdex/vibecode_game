# Plan: Distinguish own record from ranking list

## Goal

Make the pinned personal record and the public ranking visually and semantically distinct. Remove `최고` from all populated stage labels in the leaderboard. Report the provenance of the two Smoke accounts.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | Separate ranking sections and shorten stage labels | [P01](../phases/2026-10-08-leaderboard-record-separation/P01-ui/phase.md) |

## Resumption

After T01, restore `.memory/current.md` to the existing [deployment task](../phases/2026-10-02-dual-login-separated-rankings-free-deploy/P03-release/T01-cloudflare-entra-deploy.md). Preserve its staged files and separate commit scope.
