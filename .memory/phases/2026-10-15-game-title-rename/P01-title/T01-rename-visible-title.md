# Task: T01 Rename visible game title

## Status: done

## Goal
Show the exact title `동물구조탐험대` in every existing public title location and keep the pending deployment changes separate.

## Decision Summary
- Rename UI and documentation title text only. Preserve package, Worker, URL, and local save identifiers.
- README has staged release changes. Commit only its heading change in this task; restore the release changes to staging afterward.

## Implementation

### I01. Visible title
- Related Files:
  - `index.html` :: `<title>` — replace old title; modify
  - `src/App.tsx` :: campaign `<h1>` — replace old title; modify
  - `src/components/Auth/LoginScreen.tsx` :: `LoginScreen`, `RouteChoiceScreen` eyebrow text — replace old title twice; modify
  - `README.md` :: first heading — replace `미로 구출대`; modify
- **Signatures & Types**: No function signature or type changes.
- **Data & Schema Fields**: None; strings only.
- **Execution Flow / Logic**: Render the exact literal in each listed location. Do not change URLs, storage keys, authentication, or game behavior. No new error path or state transition.

### I02. Existing test
- Related Files:
  - `src/App.test.tsx` :: campaign heading assertion — expect `동물구조탐험대`; modify
- **Signatures & Types**: No new test helper.
- **Data & Schema Fields**: None.
- **Execution Flow / Logic**: Keep the existing heading layout assertion and update only its expected accessible name.

## Acceptance Criteria
- [x] Campaign, login, route selection, browser tab, and README show `동물구조탐험대`.
- [x] Old public titles have no remaining production-code occurrences.
- [x] Release changes are not in this task commit and remain staged afterward.

## Validation
- `npm.cmd test -- --run src/App.test.tsx src/components/Auth/LoginScreen.test.tsx` — focused regression passes
- `npm.cmd run lint` — type check passes
- `npm.cmd run build` — production build passes
- `git diff --check` — no whitespace errors

## Commit Message
```text
feat(ui): 게임 이름을 동물구조탐험대로 변경

Plan: 2026-10-15-game-title-rename
Phase: P01-title
Task: T01-rename-visible-title

- 캠페인, 로그인, 경로, 브라우저 제목 변경
- README 제목과 제목 검증 코드 정리
```

## Progress
- [x] Implementation complete
- [x] Validation passed (20 focused tests, lint, build, diff check)
- commit: `8edff19`
