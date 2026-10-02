# Task: T01 가로폭 맵틀과 조금 넓어진 고정 시야

## Status: done

## Goal

단계 선택 후 게임 세션에서는 `동물 구출 대작전` 제목 영역을 제거한다. 맵틀은 페이지에서 사용 가능한 가로폭을 채우고 내부의 약 `10.33×7`칸 시야를 모든 창에서 유지한다. 맵틀이 창보다 길면 문서 세로 스크롤을 허용하며, 일시정지·결과 창은 현재 보이는 브라우저 영역에서 조작할 수 있게 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-full-width-fixed-maze-view.md): 맵틀은 너비를 기준으로 같은 비율로 확대한다. 높이 때문에 축소하지 않으며 문서 세로 스크롤을 허용한다. 타일 baseline은 `140px`에서 `120px`로 바꿔 보이는 칸 수를 약 `8.86×6`에서 `10.33×7`로 늘린다.
- 게임 세션의 `ready`, `playing`, `paused`, `won`, `lost` 및 저장된 세션 복구 중에는 제목 header가 없어야 한다. 캠페인에서는 기존 제목을 유지한다.
- [직전 구현](../../../decisions/2026-10-01-laptop-wide-maze-mobile-arrows.md)의 `600px` 이하 방향 버튼, 키보드 입력, 좌표·저장 데이터는 유지한다.

## Implementation

### I01. 세션 제목 제거와 문서 세로 흐름

- Related Files:
  - `src/App.tsx` :: `App`의 `<main data-game-active>`와 `<header>` — modify
  - `src/styles/global.css` :: `main[data-game-active='true']`, 게임 section, 캠페인 header 규칙 — modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.gameContent`, `.playfieldArea`, `.controlsArea` — modify
  - `src/App.test.tsx` :: `describe('App')`의 캠페인↔세션/저장 복구 테스트 — modify

#### Details

- **Signatures & Types**:
  ```tsx
  // App: session은 기존 SavedSession | null. 신규 prop·저장 필드 없음.
  <main data-game-active={session ? 'true' : undefined}>
    {!session && <header>/* 기존 h1, p, StickerIcon 내용 그대로 */</header>}
    <section>{session ? <GameScreen ... /> : <CampaignScreen ... />}</section>
  </main>
  ```
- **Data & Schema Fields**: `session`의 truthiness만 화면 분기에 사용한다. `SaveData`, `SavedSession`, `GameState`와 stage 기록에는 필드를 추가하지 않는다. 저장된 세션을 복구해 `paused`로 진입해도 header는 숨긴다.
- **Execution Flow / Logic**:
  1. 캠페인에서는 기존 제목 header와 단계 선택 UI를 유지한다. 게임 세션이 생기면 header 노드를 렌더하지 않아 시각 공간과 접근성 트리에서 모두 빠지게 한다. 게임을 버리고 캠페인으로 돌아오면 header를 다시 렌더한다. `<main>`의 기존 `data-game-active` 표식은 유지한다.
  2. 게임 중 `main`의 고정 `height: 100dvh`를 없애고 `min-height: 100dvh; height: auto` 또는 이에 상응하는 자연 문서 높이로 전환한다. section의 `flex:1; min-height:0` 등 높이 제한, `.screen {height:100%}`, `.gameContent`/`.playfieldArea`의 높이를 강제로 남는 공간에 맞추는 flex 설정을 점검해 맵틀·시작 버튼·모바일 방향 버튼이 정상적인 세로 페이지 흐름을 만들게 한다. 캠페인의 문서 높이와 CSS는 바꾸지 않는다.
  3. 너비 안쪽 여백(PC 16px, 600px 이하 8px)은 유지할 수 있으나, 맵틀 너비는 그 안의 `.playfieldArea` 가용 너비에 정확히 맞추어 좌우에 추가 빈 공간이 남지 않게 한다. `body`/문서/맵틀 내부에 가로 스크롤을 만들지 않는다.
- **Error & Exception Handling**: 게임 화면이 짧은 창보다 높아져도 내용이 잘리지 않고 문서 세로 스크롤로 접근 가능해야 한다. `ready`의 시작 버튼 및 모바일 방향 버튼이 맵틀 뒤에 이어서 보인다. 캠페인으로 복귀하면 제목과 원래 단계 목록이 회복된다.
- **Tests**: `App.test.tsx`에서 캠페인 heading 존재, 단계 진입 뒤 heading 부재, 복구된 세션에서 부재, 세션 폐기 뒤 재등장을 확인한다. 세션 표식과 저장 상태 전환의 기존 회귀 테스트는 유지한다.

### I02. 높이 제한 없는 가로폭 배율과 새 고정 시야

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `BASE_FRAME_WIDTH`, `BASE_FRAME_HEIGHT`, `sceneScale`, `playfieldAreaRef`, `useLayoutEffect.measure` — modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT`, `TARGET_VISIBLE_COLUMNS`, `TARGET_VISIBLE_ROWS`, `CELL_SIZE`, `cameraOffset` 호출 — modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: 게임 영역 크기 측정·resize 테스트 — modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 시야·카메라·스프라이트 회귀 테스트 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  const BASE_FRAME_WIDTH = 1250
  const BASE_FRAME_HEIGHT = 850
  const sceneScale: number = availableWidth / BASE_FRAME_WIDTH
  // .playfield: width = BASE_FRAME_WIDTH * sceneScale (= availableWidth),
  //             height = BASE_FRAME_HEIGHT * sceneScale

  const VIEWPORT_WIDTH = 1240
  const VIEWPORT_HEIGHT = 840
  const TARGET_VISIBLE_COLUMNS = 10.3
  const TARGET_VISIBLE_ROWS = 7
  const CELL_SIZE = Math.floor(Math.min(
    VIEWPORT_WIDTH / TARGET_VISIBLE_COLUMNS,
    VIEWPORT_HEIGHT / TARGET_VISIBLE_ROWS,
  )) // 120
  // MazeBoard: cellSize = CELL_SIZE * sceneScale,
  //            viewWidth = VIEWPORT_WIDTH * sceneScale,
  //            viewHeight = VIEWPORT_HEIGHT * sceneScale,
  //            borderWidth = 5 * sceneScale
  ```
- **Data & Schema Fields**: `sceneScale: number`은 `GameScreen`의 표시 전용 state다. 미로 `row/col`, 플레이어 좌표, `GameState`, 저장 스키마를 수정하지 않는다. `MazeBoardProps.scale?: number`와 `PlayerSprite`의 `cellSize`/`--sprite-size: calc(var(--cell-size) * 1.6)` 소비 방식을 유지한다.
- **Execution Flow / Logic**:
  1. `playfieldArea.getBoundingClientRect()`의 **너비만**으로 배율을 계산한다. 기존 `Math.min(width / 1250, height / 850)`의 높이 항을 제거한다. 유효한 양수·finite 너비에서만 업데이트하고 0인 jsdom 측정값이면 이전 scale을 유지한다. `ResizeObserver`와 `window.resize` fallback, cleanup, 동일 값 불필요 업데이트 방지 로직은 유지한다.
  2. `.playfield` outer `1250×850 × sceneScale`이 `.playfieldArea` 너비를 채운다. `MazeBoard`의 content `1240×840 × sceneScale`, border `5 × sceneScale`, 타일 `120 × sceneScale`, 카메라 offset에 같은 배율을 적용한다. 가로·세로 타일 비율은 항상 `1240/120 ≈ 10.33`, `840/120 = 7`이다. 맵틀 높이가 남는 창 높이보다 클 때 축소하거나 잘라내지 않는다.
  3. `cameraOffset`의 경계 제한 공식은 유지하되 새 `CELL_SIZE`를 받아 시작·중앙 추적·끝점 좌표를 다시 계산한다. 기존 장애물·플레이어·동물 애니메이션 및 출구 배치 로직은 그대로 둔다.
- **Error & Exception Handling**: 너비가 0 이하 또는 `NaN`/무한대면 측정값을 무시한다. 한 축만 늘리거나 타일을 정수로 다시 반올림하지 않아야 비율이 흔들리지 않는다. 창 높이 변경만으로 게임 상태·카메라 배율·타이머·저장 호출이 바뀌지 않아야 한다.
- **Tests**: `GameScreen.test.tsx`에서 area 너비 `1250`, `625`, `1600`에 따라 frame `1250×850`, `625×425`, `1600×1088`; 타일 `120`, `60`, `153.6px`을 확인한다. 같은 너비 `1250`에서 측정 높이만 `850→650`으로 줄여도 frame이 `1250×850`이고 게임 좌표·상태 변경 콜백 수가 유지되는지 확인한다. `MazeBoard.test.tsx`에서 기본 카메라는 player `(12,12)`일 때 `(-880,-1080)`, `(13,13)`에서 `(-1000,-1200)`, 끝 `(29,29)`에서 `(-2480,-2880)`으로 갱신한다. scale `0.5`의 중앙 `(-440,-540)`, 끝 `(-1240,-1440)`과 scale `1.28`의 중앙 `(-1126.4,-1382.4)`을 근삿값으로 확인한다. `--cell-size`, border, 플레이어/타일 `1.6` 비율도 검증하고 기존 `140px`, `70px`, 구 카메라 기대값을 전역 검색해 필요한 테스트만 수정한다.

### I03. 긴 맵틀에서도 닿는 팝업과 실제 브라우저 확인

- Related Files:
  - `src/components/Overlays/Overlays.module.css` :: `.overlay`, `.panel` 및 모바일/낮은 가로 규칙 — modify
  - `src/components/Overlays/PauseOverlay.tsx`, `ResultOverlay.tsx` :: 역할·버튼·레이블 — read-only
  - `src/components/GameScreen/GameScreen.test.tsx`, `src/components/Hud/GameHud.test.tsx` :: paused/won/lost 기능 회귀 — modify only if access regression needs a focused assertion

#### Details

- **Signatures & Types**:
  ```css
  .overlay {
    position: fixed;
    inset: 0;
    /* viewport 기준; 전체 창을 덮음 */
  }
  ```
- **Data & Schema Fields**: 새 상태·저장 필드 없음. 기존 `role="dialog"`, `aria-modal`, 팝업 heading 연결과 버튼 핸들러를 유지한다.
- **Execution Flow / Logic**:
  1. 현재 desktop의 `.overlay {position:absolute}`는 키가 큰 `.playfield`의 가운데에 패널을 놓으므로 `position:fixed`를 모든 화면에 적용한다. 기존 600px 이하/낮은 가로 창의 fixed 선언은 중복이면 제거한다. 패널은 viewport 중앙에 두고, 기존 작은 화면의 폰트·버튼 크기 조정을 유지한다.
  2. `paused`, `won`, `lost` 팝업에서 이어하기·재시작·단계 선택 등 모든 버튼이 보이는 창 안에 있는지 확인한다. 아주 낮은 창에서는 팝업 자체의 `overflow-y:auto` fallback은 허용하되 게임 맵틀 안에 스크롤을 만들지 않는다.
  3. 실제 브라우저에서 대표 크기 `1366×900`, `1843×900`(첨부 이미지와 비슷한 넓은 창), `390×844`, `844×390`을 검증한다. `frame.width`가 `.playfieldArea.width`와 약 1px 오차 이내인지, `documentElement.scrollWidth <= clientWidth`, tall frame에서 `scrollHeight > clientHeight`, 내부 맵 칸 수 `10.33×7`과 player/tile `1.6`, 게임 heading 부재, 캠페인 heading 복귀를 측정한다. 시작·방향 버튼과 일시정지·결과 패널 경계 및 키보드 이동도 확인한다.
- **Error & Exception Handling**: 전체 창 기준 overlay는 문서 스크롤 위치가 바뀌어도 접근 가능해야 한다. 캠페인에는 게임 overlay가 없어야 한다.

## Acceptance Criteria

- [x] 캠페인 제목은 단계 선택에서만 보이고, 게임 진입·복구·일시정지·결과 중에는 제목 영역 자체가 없다.
- [x] 맵틀이 플레이 페이지의 사용 가능한 가로폭을 채우며, 세로가 창을 넘으면 문서 세로 스크롤만 생긴다. 좌우 빈 띠·가로 스크롤·맵틀 내부 스크롤은 없다.
- [x] 모든 창에서 보이는 시야가 가로 약 `10.33`칸·세로 `7`칸으로 일정하고 플레이어/타일 비율·카메라 경계가 유지된다.
- [x] 준비·플레이·일시정지·승리·패배에서 HUD·시작 버튼·모바일 방향 버튼·팝업이 접근 가능하다. 600px 이하 방향 버튼 및 캠페인 동작은 유지된다.
- [x] 전체 테스트, 타입 검사, 빌드, 대표 브라우저 화면 확인이 통과한다.

## Validation

- `npm.cmd test -- --run --maxWorkers=2` — 전체 Vitest 회귀 테스트 통과.
- `npm.cmd run lint` — TypeScript 검사 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- `npm.cmd run dev -- --host 127.0.0.1` — 브라우저에서 위 네 크기의 제목·가로폭·시야·세로 스크롤·조작·팝업 확인. 브라우저 자동화가 불가하면 수행한 범위와 미검증 항목을 기록한다.

## Commit Message

```text
feat(maze): 제목을 숨기고 맵틀 너비와 내부 시야 확대

Plan: 2026-10-02-full-width-fixed-maze-view
Phase: P01-full-width-scene
Task: T01-expand-frame-and-zoom-out

- 게임 세션 제목 영역을 제거하고 맵틀을 페이지 가로폭에 맞춤
- 10.3×7칸 시야와 세로 스크롤·고정 팝업을 적용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 전체 테스트 107개, lint, build, Chrome 1366×900·1843×900·390×844·844×390, 스크롤 후 일시정지·시간 초과 팝업 확인
- commit: 이 Task의 구현 커밋 (`git log` 참조)

- `.memory/`는 `.gitignore` 대상이므로 실행 단계에서 이 Task 파일을 `git add -f`로 명시적으로 스테이징한다.
