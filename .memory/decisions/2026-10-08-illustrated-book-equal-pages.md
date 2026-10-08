# Decisions: Illustrated book and equal-height pages

- Date: 2026-10-08
- Status: Confirmed

## D01. Match page heights
- **Chosen**: Both desktop panes and their content sections stretch to the same grid-row height, including the short-desktop (`max-height: 650px`) layout. Keep short-viewport page scrolling where needed.
- **Rationale**: The current short-desktop media rule changes the campaign page to `height: auto`, which can leave it shorter than the ranking page.

## D02. Replace the synthetic cover
- **Chosen**: Generate one transparent-background, top-down illustration of an open children's storybook with two spacious blank cream pages, a gentle center fold and small woodland details confined to the edges. Use it as the desktop workspace background. Preserve the functional leaderboard-left/stages-right layout.
- **Rationale**: An illustrated image directly addresses the request for a cuter book background while keeping content readable.

## D03. Responsive treatment
- **Chosen**: Keep desktop content on lightly translucent page surfaces over the illustration. On mobile, retain the existing stage/ranking tabs and simple single-page panels without stretching the two-page image into a phone layout.
- **Rationale**: The wide book image belongs to the two-column desktop composition; mobile readability and touch controls take priority.

## D04. Asset and workflow
- **Chosen**: Use the built-in image generator, save the selected image under `public/assets/campaign/`, and cite its final prompt and path. Keep the previous Cloudflare/Microsoft deployment task separate, then deploy the verified UI update to the existing Worker.
- **Rationale**: The user requested a bitmap book background for the app. The prior deployment task is already active and has staged files to preserve.
