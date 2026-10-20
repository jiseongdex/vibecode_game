# Task: T02 게임 화면 틀 확대

## Status: done

## Goal
창에서 미로 화면이 큼직하게 보이도록 이전 화면 틀보다 넓고 높게 만들고, T01의 타일·캐릭터 확대는 유지한다.

## Decision Summary
- `.memory/decisions/2026-10-01-zoomed-maze-viewport.md`의 최신 D06을 따른다. D06이 화면 틀 크기에 관한 D01·D03·D05보다 우선한다.
- 화면 틀과 보드 내부 그림 칸은 별도 크기다. 이번 작업은 CSS의 화면 틀만 바꾼다.

## Implementation

### I01. 게임 화면의 가용 너비 확대
- Related Files:
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen` — 게임 화면의 최대 너비; modify
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen` — 화면 구조 확인; read-only

#### Details
- **Signatures & Types**: CSS 선택자만 수정한다. React props 및 TypeScript 타입 변경 없음.
- **Data & Schema Fields**: 새 필드 없음.
- **Execution Flow / Logic**:
  1. `.screen`의 `width: min(100%, 960px)`를 `width: min(100%, 1120px)`로 바꾼다. `margin: 0 auto`, padding, 모바일 padding은 그대로 둔다.
  2. 브라우저 폭이 1120px보다 좁으면 `100%`가 우선하므로 가로 스크롤이 생기지 않게 한다. `box-sizing: border-box`는 유지한다.

### I02. 미로 화면 틀을 넓고 높게 표시
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport`, 두 반응형 미디어 쿼리 — 보이는 미로 화면 크기; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`, `cameraOffset` — 화면 측정과 타일 확대 확인; read-only

#### Details
- **Signatures & Types**: CSS 선택자만 수정한다. `MazeBoard` 함수 시그니처와 카메라 함수는 그대로다.
- **Data & Schema Fields**: `MazeBoard`의 `viewport: { width: number; height: number }` 상태 및 `--cell-size`는 기존 그대로다.
- **Execution Flow / Logic**:
  1. `.viewport`에서 `width: min(100%, 91vh, 850px)`와 `aspect-ratio: 17 / 13`을 제거하고 `width: 100%`, `height: min(80vh, 760px)`로 설정한다. 기존 `min-height: 0`, `margin-inline: auto`, `box-sizing: border-box`, `overflow: hidden`은 유지한다. 확대 전 기본 높이 `min(70vh, 650px)`보다 높게 보인다.
  2. `@media (max-width: 600px)`의 `width: min(100%, 68vh, 588px)`를 제거하고 `height: min(60vh, 540px)`로 설정한다. 공통 `width: 100%`와 모바일 `border-width: 3px`는 유지된다.
  3. `@media (max-height: 520px) and (orientation: landscape)`의 `width: min(100%, 62.8vh, 392px)`를 제거하고 `height: min(52vh, 360px)`로 설정한다. 이 규칙은 모바일 규칙보다 아래에 있으므로 겹치면 최종 높이가 된다.
  4. T01의 `TARGET_VISIBLE_COLUMNS`, `TARGET_VISIBLE_ROWS`, `cellSize` 계산과 카메라 clamp, 스프라이트 계층·이동 규칙은 변경하지 않는다. `ResizeObserver`가 새 화면 크기를 읽어 기존 방식으로 내부 그림 칸을 확대한다.

### I03. 기존 보드 검증 유지
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `describe('MazeBoard')` — 기존 보드 회귀 검사; read-only

#### Details
- **Signatures & Types**: 테스트 fixture와 타입 변경 없음.
- **Data & Schema Fields**: 새 테스트 데이터 없음.
- **Execution Flow / Logic**:
  1. 기존 보드 테스트가 확대된 칸 크기, 카메라 경계, 플레이어·동물 위치를 계속 통과하는지 확인한다.
  2. JSDOM은 실제 CSS 레이아웃을 계산하지 않으므로 화면 틀의 픽셀 크기 자체는 CSS 속성 검토로 확인한다. 브라우저가 제공되면 실제 화면을 추가 확인한다.

## Acceptance Criteria
- [x] 데스크톱에서 게임 화면의 최대 너비가 1120px이고 미로 틀이 그 가용 너비를 채운다.
- [x] 미로 틀의 기본 높이는 `min(80vh, 760px)`이며 모바일·낮은 가로 화면에도 크기 제한이 적용된다.
- [x] 타일·캐릭터 확대와 플레이어 추적, 맵 가장자리 제한은 유지된다.
- [x] 게임 좌표, 저장 형식, 이동/충돌 규칙은 변경하지 않는다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 보드 회귀 검사 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 확대된 미로 화면 틀을 넉넉하게 조정

Plan: 2026-10-01-zoomed-maze-viewport
Phase: P01-viewport-zoom
Task: T02-enlarge-playfield-frame

- 게임 화면 가용 너비를 확대
- 미로 화면 틀을 창 크기에 맞춰 넓고 높게 표시
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
