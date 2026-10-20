# Task: T01 Equal-height pages and illustrated book background

## Status: done

## Goal

At desktop widths, the leaderboard and stage-selection pages have matching top and bottom edges even when the viewport is short. Replace the synthetic gradient cover/spine with a cute generated illustration of an open storybook, while keeping text, stage icons and controls legible.

## Decision Summary

- Keep ranking left, stage selection right, mobile tabs, 10-row ranking pagination, and all game behavior.
- Generate a raster asset with the built-in image generator; save it in `public/assets/campaign/` and reference only the workspace copy.
- Short desktop may scroll vertically but both page surfaces must share a height. The 1440×900 desktop layout should not gain page scroll.

## Implementation

### I01. Book image asset

- Related Files:
  - `public/assets/campaign/open-storybook.png` :: transparent open-book illustration — new bitmap asset generated with built-in imagegen.

#### Details

- **Data & Schema Fields**: No API or database changes. Image is a static asset loaded by CSS.
- **Prompt**: `Use case: illustration-story. Asset type: desktop campaign workspace background. A single open children's storybook seen exactly from above, wide landscape composition, symmetrical left and right blank cream pages with large clear central areas for live UI overlays, softly rounded paper corners, gentle center fold and layered page edges. Tiny cute woodland animals, leaves, flowers, mushrooms and stars only around the outside edges and corners. Soft watercolor/gouache texture, warm peach, sage, sky blue and butter yellow, friendly and polished. Transparent background outside the book. No text, no numbers, no logos, no controls, no watermark. Avoid dark or busy marks in the central 80% of either page.`
- Generate once, inspect the result, iterate only if a concrete usability flaw remains. Copy the selected asset from the image generator output to the exact workspace path. Do not overwrite existing assets.

### I02. Desktop layout and page-height fix

- Related Files:
  - `src/components/Campaign/CampaignWorkspace.module.css` :: `.workspace`, `.workspace::before`, `.pane`, short-desktop/mobile media rules — replace gradient cover and pseudo-spine with `url('/assets/campaign/open-storybook.png')`, size/position the image and stretch both pane containers; modify.
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.panel` and responsive height rules — use a readable translucent page overlay, preserve ranking internal scroll only when space is genuinely short; modify.
  - `src/components/Campaign/CampaignScreen.module.css` :: `.campaign` and short-desktop rule — use matching translucent page overlay and `height/min-height` rules that fill the pane; modify.

#### Details

- Desktop `.workspace` remains a two-column grid. Background image is centered and fills the book cover. Pages align to its two leaves with equal outer padding and a small center gap; image remains visible around outer edges/fold.
- Both `.pane` children stretch to the grid-row height. Their direct section elements fill each pane. In the `max-height:650px` desktop rule, avoid leaving `.campaign` at intrinsic height while the leaderboard determines a taller row; allow the workspace/body to scroll vertically.
- Use soft semi-opaque backgrounds for each page so generated decoration does not reduce text contrast. Preserve page art visibility around edges and center seam.
- At `max-width:900px`, keep the existing tab visibility/order and switch off the wide book background; restore standalone rounded page panels.

### I03. Verification

- Related Files:
  - `src/components/Campaign/CampaignWorkspace.module.css`, `src/components/Leaderboard/LeaderboardPanel.module.css`, `src/components/Campaign/CampaignScreen.module.css` :: responsive layout — verify rendered geometry; modify if visual checks reveal clipping.

#### Details

- Browser check at 1440×900 and 1213×600: both visible page surfaces have equal top/bottom coordinates; 1440×900 document has no scroll and 10 ranking rows fit. Check 390px mobile tab mode for width overflow and readable content.
- Run focused campaign/leaderboard/app tests, full tests, lint, build, and whitespace check.

## Acceptance Criteria

- [x] At desktop widths, the two page surfaces match in height at 1440×900 and a short 1213×600 viewport.
- [x] Desktop shows the generated cute open-book image behind readable UI; no synthetic gradient spine is needed.
- [x] 1440×900 has no document/ranking-list scroll; mobile tabs remain readable and usable without horizontal overflow.
- [x] No API, records, rank logic or game controls change.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/Leaderboard/LeaderboardPanel.test.tsx src/components/Campaign/CampaignScreen.test.tsx` — focused UI behavior.
- `npm.cmd test -- --run` — full regression.
- `npm.cmd run lint` — type check.
- `npm.cmd run build` — production assets.
- `git diff --check` — whitespace check.
- Browser measurements at 1440×900, 1213×600, and 390px — page rectangles, scroll bounds, and visual inspection.

## Commit Message

```text
feat(campaign): 책 그림을 추가하고 양쪽 페이지 높이 정렬

Plan: 2026-10-08-illustrated-book-equal-pages
Phase: P01-book-ui
Task: T01-equal-pages-book-image

- 펼친 동화책 배경 그림 추가
- 랭킹과 단계 페이지 높이를 같게 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 28705b1
