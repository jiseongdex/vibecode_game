# Task: T01 Compact the pages and reveal the book illustration

## Status: done

## Goal

Make the book illustration clearly visible around and through the desktop content without reducing readability or changing behavior.

## Implementation

- `src/components/Campaign/CampaignWorkspace.module.css` :: `.workspace`, `.pane`, responsive rules. Increase desktop book-edge and fold insets while preserving equal pane heights; reset them for mobile.
- `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel`, `.row`, `.myRecord`, `.rankings`, `.topList`. Make the page surface transparent, compact desktop ranking rows and spacing so 10 entries and pagination fit at 1440×900; restore a solid mobile panel.
- `src/components/Campaign/CampaignScreen.module.css` :: `.campaign`, `.grid`, `.stageIcon`, `.stage strong`. Show the book art around controls and reduce the desktop stage route footprint; preserve mobile controls.
- `src/components/Player/PlayerAppearancePicker.module.css` :: `.picker`, `.picker button`, `.picker img`. Compact desktop picker controls only if needed to protect stage-grid space.
- No data or model schema changes.

## Validation

- Browser inspect at 1440×900 and the supplied short desktop aspect ratio: illustration visible, equal page heights, readable text, active controls, and no overflow at 1440×900. Check 390px mobile tab layout.
- `npm.cmd test -- --run src/App.test.tsx src/components/Leaderboard/LeaderboardPanel.test.tsx src/components/Campaign/CampaignScreen.test.tsx`
- `npm.cmd test -- --run`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

## Commit Message

```text
fix(campaign): reveal illustrated book around content

Plan: 2026-10-08-visible-book-pages
Phase: P01-layout
Task: T01-compact-pages

- Inset and compact desktop ranking and stage pages
- Keep illustration visible without mobile layout changes
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
