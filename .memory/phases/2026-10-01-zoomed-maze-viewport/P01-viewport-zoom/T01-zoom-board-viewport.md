# Task: T01 미로 플레이 시야 확대

## Status: done

## Goal
플레이 중 보이는 미로를 캡처처럼 가로 약 8~9개, 세로 약 6~7개의 시각 격자 칸으로 제한하여 주변을 따라 탐험하도록 한다. 여러 화면 크기에서도 이 범위와 기존 카메라 추적을 유지한다.

## Decision Summary
- `.memory/decisions/2026-10-01-zoomed-maze-viewport.md`의 D01~D04를 따른다. 시각 격자 한 칸은 `boardGeometry.ts`의 `visualSize`가 세는 단위로, 논리 미로 한 칸과 다르다.
- `MazeBoard`에 이미 `cameraOffset`과 `ResizeObserver` 기반 크기 측정이 있다. 새 카메라 상태나 게임 상태 필드를 만들지 않는다.

## Implementation

### I01. 뷰포트의 가로·세로 비율 통일
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport`, `@media (max-width: 600px)`, `@media (max-height: 520px) and (orientation: landscape)` — 뷰포트 크기; modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.playfield` — 부모 가용 너비 확인; read-only

#### Details
- **Signatures & Types**: CSS 선택자만 수정한다. React props와 TypeScript 타입은 변경하지 않는다.
- **Data & Schema Fields**: 없음. DOM 구조와 저장 스키마는 그대로 둔다.
- **Execution Flow / Logic**:
  1. `.viewport`의 기존 `width: 100%`, 독립적인 `height: min(70vh, 650px)`, `min-height: 300px`을 `width: min(100%, 91vh, 850px)`, `aspect-ratio: 17 / 13`, `height: auto`, `min-height: 0`, `margin-inline: auto`로 바꾼다. `17:13`은 목표인 가로 8.5칸·세로 6.5칸과 같은 비율이다. `91vh` 너비 상한은 높이를 약 `70vh` 안에, `850px` 상한은 높이를 약 `650px` 안에 둔다.
  2. 모바일 `max-width: 600px` 구간에서는 기존 독립 `height`와 `min-height`를 제거하고 너비를 `min(100%, 68vh, 588px)`로 제한한다. 높이는 공통 `aspect-ratio`에서 계산되어 기존 `52vh`·`450px` 높이 상한과 대체로 일치한다. 기존 얇은 테두리 규칙은 유지한다.
  3. 낮은 가로 화면용 마지막 미디어 쿼리에서는 기존 독립 `height`와 `min-height`를 제거하고 너비를 `min(100%, 62.8vh, 392px)`로 제한한다. 공통 비율에서 높이가 기존 `48vh`·`300px` 상한을 넘지 않게 한다. 이 규칙은 모바일 규칙보다 아래에 있어 겹칠 때 우선한다.
  4. `overflow: hidden`, 테두리, 보드와 스프라이트의 표시 순서는 유지한다. 높이 최소값을 없애 좁은 화면에서 뷰포트가 화면보다 커지는 문제를 막는다.

### I02. 가로·세로를 함께 사용해 칸 크기 산정
- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`, `ViewportSize`, `cameraOffset` — 그림 칸 크기와 카메라 변환; modify
  - `src/components/MazeBoard/boardGeometry.ts` :: `visualSize`, `visualCell` — 시각 격자 규칙 확인; read-only
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite` — 전달된 `cellSize`로 좌표 산정; read-only
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite` — 전달된 `cellSize`로 좌표 산정; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  interface ViewportSize { width: number; height: number } // 기존 구조 유지
  function cameraOffset(
    visualCoordinate: number,
    boardTiles: number,
    cellSize: number,
    viewportSize: number,
  ): number // 기존 시그니처와 본문 유지
  const TARGET_VISIBLE_COLUMNS = 8.5
  const TARGET_VISIBLE_ROWS = 6.5
  const cellSize: number = Math.max(
    1,
    Math.floor(Math.min(
      viewport.width / TARGET_VISIBLE_COLUMNS,
      viewport.height / TARGET_VISIBLE_ROWS,
    )),
  )
  ```
- **Data & Schema Fields**: 새 상태·저장 필드 없음. 기존 `viewport.width`, `viewport.height`는 DOM 측정값(px)이고 `cellSize`는 양의 정수(px)이다. `state.player.row/col` 및 `state.maze.size`의 의미는 그대로다.
- **Execution Flow / Logic**:
  1. 기존 `logicalCellSize = clamp(floor(viewport.width / 9), 36, 52)`와 `Math.floor(logicalCellSize / 2)`를 위의 두 축 기반 `cellSize`로 교체한다. 뷰포트 측정·resize 구독 코드는 유지한다.
  2. `visualSize(state.maze.size)`와 플레이어의 시각 격자 좌표를 그대로 `cameraOffset`에 넣는다. 카메라의 중앙 추적, 맵보다 큰 뷰포트에서의 중앙 배치, 맵 끝에서의 clamp 처리는 변경하지 않는다.
  3. CSS 변수 `--cell-size`, `--visual-size`와 `PlayerSprite`·`RescueSprite`의 기존 `cellSize` props 전달을 유지한다. 움직임·구출·탈출구 좌표와 스프라이트 z-index는 수정하지 않는다.
  4. 계산에 들어오는 너비/높이가 매우 작아도 `Math.max(1, …)`로 0px 칸을 피한다. 브라우저의 실제 크기는 I01의 비율을 따르고, JSDOM의 초기 측정 fallback은 기존 `640×480`을 유지한다.

### I03. 확대 및 카메라 회귀 검사 갱신
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `describe('MazeBoard')`, 스프라이트 좌표·카메라·좁은 뷰포트 테스트 — 검증; modify

#### Details
- **Signatures & Types**: 기존 `stateFor`, `render(<MazeBoard … />)` 테스트 패턴을 유지한다. 게임 모델과 테스트 fixture 타입은 변경하지 않는다.
- **Data & Schema Fields**: 새 테스트 fixture 필드 없음. 테스트 DOM의 `--cell-size`, `style.transform`, `data-grid-row/col`만 읽는다.
- **Execution Flow / Logic**:
  1. JSDOM 초기 fallback `640×480`에서는 `cellSize=73`이며 가로 `640/73≈8.77`, 세로 `480/73≈6.58`칸이 보이는지 검사한다. 스프라이트 좌표 테스트의 기존 고정 `26px`은 보드의 `--cell-size`에서 읽은 크기로 계산하도록 바꿔 확대 시에도 플레이어·동물이 해당 좌표에 놓이는지 검증한다.
  2. 기존 카메라 테스트의 고정 transform은 새 크기에 맞춘다. 시각 좌표 `(12,12)`에서 `translate3d(-592.5px, -672.5px, 0)`, `(13,13)`에서 `translate3d(-665.5px, -745.5px, 0)`이다. 플레이어가 시작 가장자리에 있을 때 `translate3d(0px, 0px, 0)`이고, 반대쪽 `(29,29)`에서는 보드 크기 `31×73=2263px`에 따라 `translate3d(-1623px, -1783px, 0)`으로 제한되는지 확인한다.
  3. 좁은 화면 측정 fixture를 CSS 비율에 가까운 `320×245`로 설정한다. 기대 칸 크기는 `37px`, 가로 `320/37≈8.65`, 세로 `245/37≈6.62`칸이다. `getBoundingClientRect` mock은 `finally`에서 반드시 복구한다.
  4. 기존 장애물 수, 열린 통로, 스프라이트 렌더 순서, 이동·구출 테스트를 삭제하거나 완화하지 않는다.

## Acceptance Criteria
- [x] 플레이 화면의 가로 시야는 약 8~9개, 세로 시야는 약 6~7개의 시각 격자 칸이다.
- [x] 기본 화면과 좁은 모바일 화면에서 시야 비율이 비슷하고 뷰포트가 화면 밖으로 넘치지 않는다.
- [x] 플레이어 이동 시 카메라가 따라가며 미로 가장자리 밖을 노출하지 않는다.
- [x] 플레이어·구출 동물·장애물·탈출구의 격자 위치와 앞뒤 표시 순서가 유지된다.
- [x] 게임 상태·저장 형식·이동/충돌 규칙은 바뀌지 않는다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 확대 시야, 좁은 화면, 카메라 clamp, 기존 보드 회귀 검사 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 미로 시야를 캡처 범위로 확대

Plan: 2026-10-01-zoomed-maze-viewport
Phase: P01-viewport-zoom
Task: T01-zoom-board-viewport

- 플레이 화면 비율과 그림 칸 크기를 확대 시야에 맞춤
- 카메라 및 스프라이트 위치 회귀 검사 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
