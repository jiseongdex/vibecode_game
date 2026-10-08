# Task: T01 Book layout and icon controls

## Status: done

## Goal

Keep the campaign screen's existing leaderboard-left/stages-right layout and mobile tabs while giving desktop pages a coherent open-book appearance. Replace the three named text controls with accessible icons and remove the public-list `내 기록` badge.

## Decision Summary

- SVG door/arrow icons are decorative within buttons whose Korean accessible names remain unchanged.
- Book effects use CSS only. Keep a 1440×900 desktop viewport free of page scroll and the mobile tab order unchanged.
- Preserve leaderboard data, rank rules, ten-row pagination, sign-out action, and disabled pagination behavior.

## Implementation

### I01. Shared controls and logout

- Related Files:
  - `src/components/Decorations/ActionIcon.tsx` :: `ActionIcon` — new SVG component with `kind: 'door' | 'arrow-left' | 'arrow-right'`, decorative `aria-hidden`/`focusable=false`, 24×24 viewBox; new.
  - `src/App.tsx` :: `AuthenticatedGame` campaign header button — use `ActionIcon kind="door"`, `aria-label="로그아웃"`, `title="로그아웃"`, preserve `onSignOut`; modify.
  - `src/styles/global.css` :: `.account-toolbar button` — 44×44 or larger borderless icon control, hover/focus/active feedback and reduced-motion handling; modify.

#### Details

- The other auth-gate logout button keeps visible text; only the campaign header's button changes.
- Use a recognizable door frame and opened door outline with rounded strokes. Do not insert emoji or a font icon dependency.
- Scope the new button styles to `.account-toolbar button`; preserve existing account-pending/auth-gate controls.

### I02. Ranking controls and badge

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `RankingRow`, `LeaderboardPanel` — remove `showBadge` prop and badge span; place arrow icons in pagination buttons while retaining `aria-label`/`title` text and existing handlers/disabled attributes; modify.
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.row`, `.myBadge`, `.pagination` — drop badge grid column/rules and style borderless arrow buttons with hover/focus/disabled states; modify.
  - `src/components/Decorations/ActionIcon.tsx` :: `ActionIcon` — shared arrows; new.

#### Details

- The current user still has `.currentUser` styling in both pinned and public rows. Keep list item `data-current-user` for tests and semantics.
- Retain rank list placeholder layout, 10 entries per page, page counter and scroll reset. Icon buttons must be at least 44×44 and disabled arrows must not show hover motion.
- CSS `@media (hover: hover)` gates hover motion; `:focus-visible` shows a clear focus ring; `prefers-reduced-motion` disables transitions.

### I03. Book layout and colors

- Related Files:
  - `src/components/Campaign/CampaignWorkspace.module.css` :: `.workspace`, `.pane`, `.leaderboardPane`, `.stagesPane`, media queries — add an outer cover, narrow central spine, and left/right page corner treatment on desktop; turn off spine/cover in mobile tab mode; modify.
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel`, own record/list accents — warm ranking page gradient and subtle colored row accents; modify.
  - `src/components/Campaign/CampaignScreen.module.css` :: `.campaign`, headings, sticker accents — pale green/peach page background and soft inner edge; modify.
  - `src/styles/global.css` :: `body` background — mix muted blue, peach, green rather than only green/gold; modify.

#### Details

- Preserve the panel's flex height/overflow and stage grid. Use gradients, inset shadows, border radii, and a narrow pseudo-element at the center; pseudo-element must not intercept clicks.
- At width <=900px, keep the existing tabs and stage-first mobile order, remove central spine, outer cover padding/shadow, and give each visible page full corner radii.
- At height <=650px preserve the existing scroll allowance; do not add fixed heights.
- Avoid changing the game board, login flow, data model, or API.

### I04. Coverage and visual checks

- Related Files:
  - `src/App.test.tsx` :: campaign header test — assert icon-only sign-out remains accessible and clickable; modify.
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: current row and pagination tests — update badge expectation, assert icon-only accessible pagination and navigation; modify.
  - `src/components/Campaign/CampaignWorkspace.module.css` and relevant CSS :: read-only visual review after build.

#### Details

- Test that no public ranking row contains `내 기록`, while the pinned region heading remains.
- Check button SVG presence, accessible names, disabled states and page switching. Verify layout at 1440×900 and a narrow mobile viewport if a browser preview is available.

## Acceptance Criteria

- [ ] Campaign header sign-out shows a door icon, keeps its accessible name and action, and has no border.
- [ ] Pagination shows arrow icons, retains accessible names and disabled/page behavior, and has no border.
- [ ] The public ranking list has no `내 기록` badge; the own-record section remains.
- [ ] Desktop presents two colored pages with book cover/spine, while mobile tabs and desktop no-page-scroll behavior remain usable.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/Leaderboard/LeaderboardPanel.test.tsx src/components/Campaign/CampaignScreen.test.tsx` — focused behavior.
- `npm.cmd test -- --run` — full regression.
- `npm.cmd run lint` — type check.
- `npm.cmd run build` — production bundle.
- `git diff --check` — whitespace check.

## Commit Message

```text
feat(campaign): add book styling and icon controls

Plan: 2026-10-08-book-campaign-icon-controls
Phase: P01-campaign-ui
Task: T01-book-layout-controls

- Style the desktop campaign as an open book
- Replace logout and pagination labels with accessible icons
- Remove the redundant current-record badge
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
