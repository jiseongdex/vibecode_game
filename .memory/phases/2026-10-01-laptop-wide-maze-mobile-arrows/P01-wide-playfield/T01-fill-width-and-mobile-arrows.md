# Task: T01 맵틀 가로폭 확대와 작은 화면 방향 버튼

## Status: done

## Goal

플레이 세션에서 화면 너비가 `600px`을 넘으면 방향 버튼과 그 예약 공간을 없애 맵틀에 가로폭을 내주고, 창 높이와 고정 시야 비율이 허용하는 한 맵틀을 확대한다. `600px` 이하에서는 현재 방향키 모양 버튼을 유지한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-01-laptop-wide-maze-mobile-arrows.md): 보이는 맵 칸 수와 플레이어·타일 비율, 스크롤 없는 화면을 우선한다. 노트북에서 가능한 가로폭까지 확대하며 방향 버튼은 너비 `600px` 이하에만 표시한다.
- [선행 결정](../../../decisions/2026-10-01-responsive-locked-maze-view.md)의 동일 배율 카메라·보드 구조는 유지한다. 시작 버튼, HUD, 일시정지·결과 창은 모든 플레이 상태에서 접근 가능해야 한다.
- 게임 상태, 저장 형식, 키보드 이동, 이미지 및 캠페인 레이아웃을 변경하지 않는다.

## Implementation

### I01. 플레이 영역의 가로폭과 배율 제한 수정

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, `sceneScale`, `useLayoutEffect`의 `measure` — modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.gameContent`, `.playfieldArea`, `.controlsArea`, `.actions`와 반응형 규칙 — modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`의 `scale` 소비 방식 — read-only; 축소뿐 아니라 1 초과 배율도 이미 받는지 확인

#### Details

- **Signatures & Types**:
  ```typescript
  const BASE_FRAME_WIDTH = 1250
  const BASE_FRAME_HEIGHT = 850
  const sceneScale: number // 초기값 1, 실제 측정 뒤 양수; 1보다 클 수 있음
  const next = Math.min(
    availableWidth / BASE_FRAME_WIDTH,
    availableHeight / BASE_FRAME_HEIGHT,
  )
  // .playfield style: width = 1250 * sceneScale,
  //                   height = 850 * sceneScale
  // MazeBoard scale={sceneScale}
  ```
- **Data & Schema Fields**: `sceneScale`은 `GameScreen`의 표시 전용 React state다. `GameState`/저장 스키마/미로의 row·col 좌표를 추가하거나 수정하지 않는다. `MazeBoardProps.scale?: number`는 기존 그대로 유지한다.
- **Execution Flow / Logic**:
  1. `playfieldAreaRef.current.getBoundingClientRect()`에서 양수 너비·높이만 받아 기존 `Math.min(1, ...)`의 `1` 상한을 제거한다. 작은 공간은 축소하고, 넓고 높은 공간은 1을 초과해 확대한다. 너비와 높이 중 먼저 차는 축이 배율을 결정한다. `ResizeObserver`와 window resize fallback, cleanup, 값이 바뀔 때만 `setSceneScale` 호출하는 로직은 유지한다.
  2. `.screen`의 `width: min(100%, 1400px)` 최대폭을 제거해 `width: 100%`로 만든다. 기존 16px(모바일 8px) 안쪽 여백은 유지하고, `.playfieldArea`가 게임 section의 남는 가로폭과 세로폭을 재도록 한다. 페이지 최대폭을 따로 새로 만들지 않는다.
  3. `.gameContent`는 데스크톱에서도 세로 배치로 유지한다. 기존 `min-width: 900px` 및 낮은 landscape 규칙의 `flex-direction: row`, `.controlsArea` `width: 214px/180px`를 제거한다. 이 옆 공간을 없애야 사용 가능한 너비가 실제로 늘어난다.
  4. `.controlsArea`에는 현행 `.actions` 시작 버튼과 `DirectionControls`를 계속 둔다. PC에서는 방향 버튼이 CSS로 숨겨져도 `ready` 상태의 시작 버튼은 맵틀 아래에 보여야 한다. `playing` 등 시작 버튼이 없을 때 PC의 `.controlsArea`는 세로 공간을 예약하지 않게 `padding-top: 0` 등으로 조정한다. 모바일에서는 기존 버튼을 위한 아래 공간과 시작 버튼을 유지한다.
  5. `.playfield` 외형 `1250 × 850 × sceneScale`과 `MazeBoard`의 content `1240 × 840 × sceneScale`, border `5 × sceneScale`, 타일 `140 × sceneScale`, 카메라 offset 배율을 유지한다. `scale > 1`이 보드에 그대로 전달되어 화면 틀, 플레이어와 카메라가 함께 확대되어야 한다.
- **Error & Exception Handling**: jsdom처럼 측정값이 0이면 이전 배율을 유지한다. 비정상 배율(0 이하, 무한대)은 저장하지 않는다. 높이 때문에 여백이 생기면 빈 공간을 두고, 시야를 늘리거나 자르거나 문서 스크롤을 만들지 않는다. 크기 변경만으로 타이머/이동/저장 상태가 변하지 않아야 한다.

### I02. `600px` 이하에서만 방향 버튼 표시

- Related Files:
  - `src/components/Controls/DirectionControls.module.css` :: `.controls` 및 미디어 쿼리 — modify
  - `src/components/Controls/DirectionControls.tsx` :: `DirectionControls`, 방향별 `aria-label`, `disabled`, `onClick` — read-only
  - `src/components/GameScreen/GameScreen.module.css` :: `.controlsArea`의 모바일/PC 여백 — modify
  - `src/hooks/useKeyboardMovement.ts` :: 키보드 방향키/WASD 이동 — read-only

#### Details

- **Signatures & Types**:
  ```css
  @media (min-width: 601px) {
    .controls { display: none; }
  }
  /* width <= 600px: 기존 3열 × 2행 방향키 배열 표시 */
  ```
- **Data & Schema Fields**: 신규 상태·prop 없음. 화면 너비는 CSS 미디어 쿼리로 판단하여 resize 시 React 게임 상태를 다시 만들지 않는다. `DirectionControlsProps`의 `disabled?: boolean`, `onMove: (direction: Direction) => void`는 유지한다.
- **Execution Flow / Logic**:
  1. 방향 버튼 그룹을 `min-width: 601px`에서 `display: none`으로 숨겨 시각적 공간과 접근성 트리에서 함께 제외한다. `600px`에서는 현행 위/왼쪽/아래/오른쪽 배치와 클릭·disabled 동작을 유지한다.
  2. 낮은 가로 화면용 `max-height: 520px` 규칙이 601px 이상에서 버튼을 다시 표시하거나 폭을 예약하지 않도록 미디어 쿼리 우선순위를 점검한다. 600px 이하 가로 화면에서는 버튼이 표시되어야 한다.
  3. 키보드 방향키/WASD 리스너는 CSS로 숨긴 버튼과 무관하게 PC에서 계속 동작한다. 600px 초과 터치 기기의 가로 화면에서도 버튼을 숨기는 것은 확정된 결정이다.
- **Error & Exception Handling**: 준비/일시정지/승리/패배 상태에서 모바일 방향 버튼의 비활성화를 유지한다. PC에서 숨겨진 버튼이 클릭 불가능한 대신 실제 키보드 입력은 `playing`일 때만 작동한다.

### I03. 회귀 테스트와 실제 창 크기 검증

- Related Files:
  - `src/components/GameScreen/GameScreen.test.tsx` :: `describe('GameScreen')`, 플레이 영역 측정 테스트 — modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 배율별 타일·스프라이트·카메라 테스트 — modify only if >1 배율의 회귀를 별도로 확인할 필요가 있을 때
  - `src/App.test.tsx` :: 세션과 캠페인 전환 — read-only

#### Details

- **Test Cases**:
  1. `GameScreen`의 측정 공간 `1250×850`에서 scale 1, `625×425`에서 0.5를 유지하고, `1600×1100`에서 scale 1.28로 프레임 `1600×1088`, 타일 `179.2px`이 되는지 확인한다. 높이 제한 사례 `1250×650`에서는 프레임 높이 650 이하, 너비 1250 이하를 검증한다. 부동소수 값은 적절한 근삿값으로 비교한다.
  2. Resize 전후 동일 미로 seed, 플레이어 위치, 시작/키보드 이동 가능 여부를 확인한다. `MazeBoard`의 `scale > 1` 카메라 변위 및 가로·세로 보이는 타일 수 비율도 필요한 경우 별도 검사한다.
  3. CSS 표시 조건과 레이아웃은 jsdom이 실제 CSS 크기 계산을 하지 않으므로 브라우저에서 확인한다. `npm.cmd run dev -- --host 127.0.0.1` 실행 후 `1366×900`, `1600×1200`, `601×800`, `600×800`, `390×844`, `844×390`에서 `document.documentElement.scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`; 게임틀·HUD·시작 버튼·오버레이의 경계; 방향 버튼 표시; 키보드 입력을 확인한다. 600/601 경계와 낮은 가로 창을 반드시 포함한다. `1600×1200`에서 배율이 1을 넘는지 확인한다.
  4. `ready`, `playing`, `paused`, `won`, `lost`에서 시작/방향 버튼과 팝업 접근성을 확인한다. 캠페인으로 돌아오면 플레이 세션 전용 높이 규칙이 적용되지 않아야 한다.

## Acceptance Criteria

- [x] 노트북·PC에서 맵틀이 방향 버튼용 옆 공간이나 1400px 화면 최대폭에 막히지 않고 사용 가능한 가로폭을 활용한다. 높이가 부족하면 동일 시야 비율을 유지하며 축소하고 페이지 스크롤이 없다.
- [x] 넓고 높은 화면에서는 배율이 1을 넘어 맵틀·타일·플레이어·카메라가 함께 커진다. 보이는 맵 칸 수와 게임 좌표는 바뀌지 않는다.
- [x] 너비 600px 이하에서만 키보드 모양 방향 버튼이 보이고, 601px 이상에서는 자리도 차지하지 않는다. PC 실제 키보드 이동과 모바일 버튼 클릭·비활성화는 그대로 동작한다.
- [x] HUD, 시작 버튼, 일시정지·결과 창이 대표 창 크기와 플레이 상태에서 접근 가능하며 캠페인 화면은 유지된다.
- [x] 전체 테스트, 타입 검사, 빌드와 브라우저 검증이 통과한다.

## Validation

- `npm.cmd test -- --run --maxWorkers=2` — 전체 Vitest 테스트 통과; 이전 브라우저 동시 실행에서 임시 공간 부족이 발생해 worker 수를 제한한다.
- `npm.cmd run lint` — TypeScript 검사 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- `npm.cmd run dev -- --host 127.0.0.1` — 실제 브라우저의 위 여섯 크기에서 화면틀·버튼·오버레이·스크롤·시야 비율 확인. 사용 가능한 브라우저 자동화 수단이 실패하면 가능한 검증 범위를 기록하고 미검증 항목을 보고한다.

## Commit Message

```text
feat(maze): 노트북 맵틀 확대와 모바일 방향 버튼 분리

Plan: 2026-10-01-laptop-wide-maze-mobile-arrows
Phase: P01-wide-playfield
Task: T01-fill-width-and-mobile-arrows

- 높이 제한 안에서 맵틀을 가로폭에 맞게 확대하고 고정 시야 비율 유지
- 600px 이하에서만 방향 버튼을 표시하고 PC 키보드 이동 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 107개 테스트, lint, build. Chrome 여섯 창 크기에서 ready/playing/paused 화면의 버튼·스크롤·비율·키보드/버튼 이동 확인. 시간 초과 팝업은 390×844, 844×390, 1366×900에서 경계 확인. won/lost 기능은 기존 React 테스트로 확인.
- commit: 이 Task의 구현 커밋 (`git log` 참조)

- `.memory/`는 `.gitignore` 대상이다. 실행 단계에서 이 Task 파일을 `git add -f`로 명시적으로 스테이징한다.
