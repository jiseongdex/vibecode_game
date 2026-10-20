# Task: T01 반응형 게임틀과 일정한 내부 시야

## Status: done

## Goal

플레이 세션의 게임틀을 창 안에 맞추되, `1240×840` 기준의 보이는 맵 범위와 플레이어·타일 비율을 같은 배율로 유지한다. 가로·세로 스크롤을 만들었던 고정 픽셀 틀을 제거하고, 낮은 가로 창에서도 게임틀·HUD·조작 버튼과 결과 창에 접근할 수 있게 한다.

## Decision Summary

- [정정된 결정](../../../decisions/2026-10-01-responsive-locked-maze-view.md): 고정 대상은 맵 시야와 캐릭터·타일의 상대 비율이다. 화면틀은 반응형이며 스크롤 없이 화면에 맞춘다.
- [이전 고정 픽셀 결정](../../../decisions/2026-10-01-fixed-maze-view.md)은 superseded 상태다. 현재의 `1240px` CSS 너비, `840px` CSS 높이와 `width: max-content`는 되돌린다.
- 게임 규칙·저장 데이터·걷기 애니메이션·이미지·캠페인 화면은 변경하지 않는다.

## Implementation

### I01. 플레이 화면의 남는 공간과 동일 배율 계산

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen` — modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.gameContent`, `.playfieldArea`, `.playfield`, `.controlsArea` — modify/new selectors
  - `src/components/GameScreen/GameScreen.test.tsx` :: `describe('GameScreen')` — modify

#### Details

- **Signatures & Types**:
  ```typescript
  const BASE_VIEW_WIDTH = 1240
  const BASE_VIEW_HEIGHT = 840
  const BASE_BORDER = 5
  const BASE_FRAME_WIDTH = BASE_VIEW_WIDTH + 2 * BASE_BORDER // 1250
  const BASE_FRAME_HEIGHT = BASE_VIEW_HEIGHT + 2 * BASE_BORDER // 850
  const scale = Math.min(1, availableWidth / BASE_FRAME_WIDTH,
    availableHeight / BASE_FRAME_HEIGHT)
  ```
- **Data & Schema Fields**: `sceneScale: number`은 `GameScreen`의 화면 전용 React state, 초기값 `1`이다. `playfieldAreaRef: RefObject<HTMLDivElement | null>`은 남는 공간을 재는 요소다. `GameState`, `MovementSource`, `movementAttempt`, 저장 필드는 그대로 둔다.
- **Execution Flow / Logic**:
  1. `GameScreen`의 HUD 아래에 게임 영역 `.gameContent`를 둔다. 그 안의 `.playfieldArea`는 `flex: 1; min-width: 0; min-height: 0`으로 실제 남는 가로·세로 공간을 차지하며 `.playfield`를 중앙 배치한다. 기존 `MazeBoard`와 `PauseOverlay`/`ResultOverlay`는 `.playfield` 안에 둔다.
  2. `.controlsArea` 안에 기존 시작 버튼 `.actions`와 `DirectionControls`를 배치한다. 세로 화면에서는 게임틀 아래, 충분히 넓거나 낮은 가로 화면에서는 게임틀 옆에 배치해 게임틀의 높이를 확보한다. 버튼의 기능·disabled 상태·레이블은 그대로다.
  3. `useLayoutEffect`에서 `.playfieldArea.getBoundingClientRect()`의 양수 너비·높이를 측정하고 `ResizeObserver`로 크기 변화를 감시한다. `ResizeObserver`가 없는 환경에는 `window.resize`를 사용한다. 측정값이 0인 jsdom 환경에서는 이전 scale을 유지한다. 계산 결과는 `0 < scale <= 1`이며 유효값이 실제로 바뀔 때만 state를 갱신한다. cleanup에서 observer/리스너를 정리한다. 자식 `.playfield` 크기는 `.playfieldArea` 크기에 영향을 주지 않아 측정 루프가 생기지 않아야 한다.
  4. `.playfield`의 실제 너비·높이를 각각 `1250 * sceneScale`, `850 * sceneScale` 픽셀로 지정하고 `MazeBoard scale={sceneScale}`에 전달한다. `.overlay { inset: 0 }`는 이 wrapper를 기준으로 게임틀 전체를 덮는다. `.playfield`의 이전 `width: max-content`는 제거한다.
- **Error & Exception Handling**: 뷰포트가 갑자기 작아지거나 커져도 scale은 양수이며 최대 1이다. 게임 타이머, 이동 카운터, 저장 호출은 크기 변경 때문에 발생하지 않는다. `ResizeObserver`가 없어도 최초 측정과 window resize로 동작한다.
- **Tests**: 크기 측정값이 `1250×850`이면 scale 1, `625×425`이면 0.5가 되어 보드의 `--cell-size`가 각각 `140px`, `70px`이고 `.playfield`가 각각 `1250×850`, `625×425`가 되는지 실제 `GameScreen` 렌더로 확인한다. resize 후 게임 상태·위치·이동 입력 기능은 유지한다.

### I02. 타일·스프라이트·카메라와 화면틀을 같은 배율로 변경

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoardProps`, `MazeBoard`, `cameraOffset` — modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport` — modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 카메라·크기 회귀 테스트 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface MazeBoardProps {
    state: GameState
    onMove: (direction: Direction) => void
    appearance?: PlayerAppearance
    movementAttempt?: number
    movementSource?: 'keyboard' | 'button'
    pressedDirections?: readonly Direction[]
    scale?: number // default 1
  }
  const cellSize = 140 * scale
  const viewWidth = 1240 * scale
  const viewHeight = 840 * scale
  const borderWidth = 5 * scale
  ```
- **Data & Schema Fields**: `scale`은 렌더링 전용 prop이며 게임 좌표와 모델에 저장하지 않는다. CSS `--cell-size`, 플레이어 `--sprite-size = cellSize * 1.6`, 동물 및 장애물 크기, 카메라 변위가 모두 동일 배율을 따른다.
- **Execution Flow / Logic**:
  1. `.viewport`의 고정 `1240px × 840px`와 단독 모바일 높이 규칙을 제거한다. JSX `style`에서 content box를 `viewWidth × viewHeight`, border 두께를 `borderWidth`로 지정한다. CSS는 `box-sizing: content-box; overflow: hidden; width/height: auto` 기본값과 디자인 색·모서리를 유지한다. 외형 크기는 `1250*scale × 850*scale`이어서 부모 `.playfield`와 정확히 일치한다.
  2. 기준 `CELL_SIZE=140`을 `scale`과 곱한 부동소수 픽셀로 사용한다. `Math.floor`로 작은 화면의 칸 크기를 별도로 반올림하지 않는다. 카메라 호출에 `viewWidth`/`viewHeight`를 넘겨 시작·중앙 추적·끝 클램프 좌표가 모두 scale 배로 바뀌게 한다. 화면틀과 타일을 같은 비율로 줄여 보이는 칸 수 `1240/140`, `840/140`을 유지한다.
  3. 기존 `useLayoutEffect`의 이동 시도 모션, 플레이어 걷기·방향 전환, follower 동작 및 배치 로직은 유지한다. 창 크기만 바뀔 때는 보드 위치와 크기만 다시 계산한다.
- **Error & Exception Handling**: `scale`이 유효하지 않거나 0 이하이면 1로 처리한다. 작은 화면에서 카메라가 보드 경계 밖을 보여주지 않도록 기존 `cameraOffset` 클램프를 유지한다.
- **Tests**: 기본 scale 1의 카메라 기대(`--cell-size:140px`, `(12,12)`에서 `-1130,-1330`, 끝에서 `-3100,-3500`)는 유지한다. scale 0.5에서 `--cell-size:70px`, viewport content `620×420`, border `2.5px`, 플레이어 크기 `112px`, `(12,12)` 카메라 `-565,-665`, 끝 클램프 `-1550,-1750`을 확인한다. 두 scale에서 보이는 가로·세로 칸 수가 같아야 한다.

### I03. 플레이 세션 전체를 화면 높이에 맞춤

- Related Files:
  - `src/App.tsx` :: `App`의 `<main>` 및 게임 section — modify
  - `src/styles/global.css` :: 플레이 중 `main`, `header`, `section` 배치 — modify
  - `src/styles/responsive.css` :: 작은 세로·낮은 가로 화면의 제목 여백 — modify only if needed
  - `src/components/GameScreen/GameScreen.module.css` :: 반응형 flex 배치 — modify
  - `src/components/Hud/GameHud.module.css` :: 낮은 화면 HUD 높이 — modify only if needed
  - `src/components/Controls/DirectionControls.module.css` :: `.controls` 여백과 낮은 화면 크기 — modify
  - `src/components/Overlays/Overlays.module.css` :: 작은 화면의 결과·일시정지 창 — modify
  - `src/App.test.tsx` :: 플레이 세션 전용 레이아웃 표식 — modify

#### Details

- **Data & Schema Fields**: `App`의 `<main>`에 세션이 있을 때만 `data-game-active="true"`를 붙인다. 캠페인 화면에는 붙이지 않는다. 새 저장 필드나 사용자 설정은 없다.
- **Execution Flow / Logic**:
  1. 플레이 중 `main[data-game-active='true']`는 `height: 100dvh; display: flex; flex-direction: column; min-width: 0`으로 하고, header는 필요한 자연 높이만 차지한다. 게임 section은 `flex: 1; min-height: 0; min-width: 0`; `.screen`은 `height: 100%; min-height: 0; display: flex; flex-direction: column`이어서 HUD 뒤의 `.gameContent`가 실제 남은 높이를 사용한다. 캠페인의 문서 높이·스크롤은 그대로 둔다.
  2. `.gameContent`는 기본 세로 배치로 `.playfieldArea` 뒤에 `.controlsArea`를 둔다. `min-width: 900px` 또는 `max-height: 520px` 가로 화면에서는 둘을 나란히 배치해 방향 버튼 때문에 화면틀이 지나치게 작아지지 않도록 한다. `.controlsArea`의 margin과 `.controls` 자체의 바깥 여백을 조절해 flex 영역의 높이/너비 밖으로 넘치지 않게 한다. 준비 상태의 시작 버튼도 접근 가능해야 한다.
  3. 작은 화면 또는 낮은 가로 화면에서 일시정지·결과 overlay는 `position: fixed; inset: 0`으로 창 전체에 표시하고, 패널 크기·글자·버튼을 창 안에 맞춘다. 넓은 화면에서는 기존 `.playfield` 기준 오버레이를 유지한다. 오버레이를 보기 위해 내부 스크롤이 필요하지 않아야 한다.
  4. 화면을 줄이기 위해 `body`나 `main`에 고정 픽셀 최소 너비를 추가하지 않는다. `body`의 `min-height`는 모바일 동적 뷰포트와 맞추고, 플레이 UI가 맞게 배치된 뒤에만 불필요한 넘침을 막는다. 가로/세로 스크롤을 CSS 숨김만으로 위장하며 HUD·조작 버튼을 잘라내지 않는다.
- **Error & Exception Handling**: `ready`, `playing`, `paused`, `won`, `lost`에서 각각 시작 버튼·HUD·방향 버튼·결과 팝업이 보이고 조작 가능해야 한다. 세션이 끝나 캠페인으로 돌아가면 원래의 단계 목록 스크롤을 복원한다.
- **Tests**: `App.test.tsx`에서 세션 전후 `data-game-active` 전환을 확인한다. 실제 브라우저에서 `1366×900`, `390×844`, `844×390`의 `document.documentElement.scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`를 검증하고 게임틀·HUD·시작/방향 버튼과 일시정지/결과 패널 경계를 확인한다. 모바일에서 플레이어/타일 비율과 카메라 시야가 데스크톱과 같은지 확인한다.

## Acceptance Criteria

- [ ] 게임 화면틀이 창의 가로·남는 세로 공간에 맞게 줄어들고, 플레이 중 문서/게임틀에 가로·세로 스크롤이 생기지 않는다.
- [ ] 데스크톱·모바일·낮은 가로 화면의 보이는 맵 칸 수와 플레이어/타일 비율이 같고, 카메라가 플레이어를 따라가며 맵 끝에서 멈춘다.
- [ ] HUD, 시작·방향 버튼, 일시정지·결과 창이 모든 대표 화면에서 보이고 조작 가능하다. 캠페인 화면 스크롤은 유지한다.
- [ ] 전체 테스트, 타입 검사, 빌드가 통과한다.

## Validation

- `npm.cmd test -- --run` — 전체 Vitest 회귀 테스트 통과
- `npm.cmd run lint` — TypeScript 검사 통과
- `npm.cmd run build` — 프로덕션 빌드 통과
- `npm.cmd run dev -- --host 127.0.0.1` — 실제 브라우저의 `1366×900`, `390×844`, `844×390`에서 문서 스크롤 치수·게임틀/오버레이/버튼 배치 확인; 지난 실행에서 브라우저 자동화 도구가 실패했으므로 다시 시도하고 불가하면 미검증 범위를 명시한다.

## Commit Message

```text
fix(maze): 반응형 화면틀에서 게임 시야 비율 유지

Plan: 2026-10-01-responsive-locked-maze-view
Phase: P01-responsive-scene
Task: T01-fit-scene-and-layout

- 화면틀을 남는 공간에 맞추고 타일·플레이어·카메라를 같은 배율로 조절
- 좁고 낮은 창에서 스크롤 없이 플레이 조작과 팝업 표시
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 107개 테스트(`npm.cmd test -- --run --maxWorkers=2`), lint, build 통과. Chrome에서 1366×900, 390×844, 844×390의 시작·플레이·일시정지 화면 문서 스크롤과 주요 요소 경계를 확인.
- commit: 이 Task의 구현 커밋 (`git log` 참조)
- `.memory/`는 `.gitignore` 대상이다. 이 Task 파일을 처음 커밋할 때 `git add -f`로 명시적으로 스테이징한다.
