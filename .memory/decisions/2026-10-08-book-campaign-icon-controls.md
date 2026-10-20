# Decisions: Book-style campaign and icon controls

- Date: 2026-10-08
- Status: Confirmed

## D01. Icon buttons
- **Chosen**: Replace the campaign header's visible `로그아웃` label with a door SVG; replace ranking pagination text with left/right arrow SVGs. Keep Korean `aria-label` and `title` for each button.
- **Rationale**: This follows the requested icon treatment without losing accessible names or the existing click actions.

## D02. Interaction
- **Chosen**: Remove borders from those three controls. Use a pastel hover background, lift/shadow on hover-capable pointers, pressed feedback, clear keyboard focus, and muted disabled arrows. Keep at least a 44px hit area.
- **Rationale**: The buttons should feel interactive without returning to outlined pills and should remain usable by keyboard and touch.

## D03. Ranking current-user marker
- **Chosen**: Remove the `내 기록` badge from public ranking rows. Keep the dedicated own-record card and the current row's color highlight.
- **Rationale**: The badge repeats the separate own-record area and adds clutter.

## D04. Book visual direction
- **Chosen**: Keep the current leaderboard-left/stage-right structure. On desktop, place both panels inside one book-like cover with a visible central spine, softer inner page edges, warm cream on the ranking page and pale sage/peach accents on the stage page. Use CSS gradients and shadows, no new bitmap assets. On mobile, retain tabs and individual page panels without a central spine.
- **Rationale**: It implements the user's spread-book idea while preserving navigation, campaign geometry, and the prior 1440×900 layout.

## D05. Existing deployment task
- **Chosen**: Finish and deploy this UI task, then restore the pending Cloudflare/Microsoft deployment task pointer. Preserve its staged files.
- **Rationale**: The user had previously prioritized screen work, then resuming deployment.
