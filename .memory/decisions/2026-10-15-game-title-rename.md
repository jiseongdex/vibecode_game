# Decisions: Game title rename

- Date: 2026-10-15
- Status: Confirmed

## D01. Public game title
- **Chosen**: Use the exact text `동물구조탐험대` for the campaign heading, login and route selection labels, browser title, and README heading.
- **Rationale**: These are the existing public placements of the old game title.

## D02. Stable identifiers
- **Chosen**: Keep `maze-rescue-game` package, Worker, URL, and save keys unchanged.
- **Rationale**: Changing internal identifiers would disrupt deployment and saved games without affecting the visible title.

## D03. Existing release work
- **Chosen**: Keep the unfinished release task and its staged files separate; resume its pointer after this single task.
- **Rationale**: Release configuration and documentation are already staged and are unrelated to this display change.
