# Task: T01 고정 게임 시야와 페이지 스크롤

## Status: done

## Goal

실제 미로 표시 영역을 창 크기와 무관한 `1240×840px`로 고정한다. 시각 격자와 플레이어는 동일한 픽셀 크기를 유지하고, 카메라는 같은 범위를 보여준다. 화면이 작으면 게임틀 전체에 문서의 가로·세로 스크롤로 접근할 수 있어야 한다.

## Decision Summary

- [고정 게임 시야 결정](../../../decisions/2026-10-01-fixed-maze-view.md): 내부 시야 `1240×840px`, 작은 창에서는 축소·잘림 없이 페이지 스크롤.
- 기존 가로 목표 `7.8`칸·세로 목표 `6.0`칸과 플레이어 `1.6`칸 표시 비율, 카메라 추적·끝 제한은 유지한다.
- 외부 제목·HUD·방향 버튼은 기존 반응형 배치를 유지한다. 게임 상태·저장 형식·이미지 파일은 변경하지 않는다.

## Implementation

### I01. `MazeBoard` 내부 기하와 카메라 고정

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`, `cameraOffset`, `ViewportSize` — modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 카메라 및 좁은 뷰포트 테스트 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  const VIEWPORT_WIDTH = 1240
  const VIEWPORT_HEIGHT = 840
  const TARGET_VISIBLE_COLUMNS = 7.8
  const TARGET_VISIBLE_ROWS = 6.0
  const cellSize = Math.floor(Math.min(
    VIEWPORT_WIDTH / TARGET_VISIBLE_COLUMNS,
    VIEWPORT_HEIGHT / TARGET_VISIBLE_ROWS,
  )) // 140
  ```
- **Data & Schema Fields**: 화면 전용 `ViewportSize { width: number; height: number }`, `viewportRef`, 실측 `viewport` state를 제거한다. `MotionSnapshot`, `MotionState`, `GameState`와 저장 데이터의 필드는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. 뷰포트 `getBoundingClientRect`/`clientWidth` 측정, `ResizeObserver`, `window.resize` 핸들러를 제거한다. 이동 모션을 계산하는 별도 `useLayoutEffect`는 유지한다.
  2. `cellSize`를 위 상수에서 구한 `140px`로 고정해 `--cell-size`로 전달한다. 플레이어 표시 상자는 기존 `1.6 × cellSize = 224px`이며 위치 보정과 동물·벽 이미지 배율은 그대로 둔다.
  3. `cameraOffset` 함수의 추적·클램프 식은 유지하되 호출 시 뷰포트 축 크기를 각각 `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT`로 전달한다. 창 크기 재조절은 보드 `transform`을 바꾸지 않아야 한다.
- **Error & Exception Handling**: 좁은 창, `ResizeObserver` 부재, 15·33 크기 미로에서 고정 기하가 동일하게 적용된다. 새 `resize` 리스너나 측정 타이머는 만들지 않는다.
- **Tests**: 현재 카메라 테스트의 시작값 `translate3d(0px, 0px, 0)`, `--cell-size: 140px`, 시야 `1240/140`, `840/140`을 검증한다. 15 크기 미로의 플레이어 `(12,12)`에서 `(-1130,-1330)`, `(13,13)`에서 `(-1270,-1470)`, `(29,29)`에서 맵 끝 제한 `(-3100,-3500)` 픽셀을 기대한다. 기존 좁은 뷰포트 `40px` 기대는 좁은 측정값과 큰 측정값 모두 `140px`·동일 카메라 결과를 기대하도록 바꾼다.

### I02. 고정 테두리·오버레이와 페이지 스크롤

- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport`, 모바일·낮은 가로 화면 media rules — modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.playfield` — modify
  - `src/components/Overlays/Overlays.module.css` :: 오버레이 위치·크기 — read-only unless fixed playfield 검증에서 실제 결함 확인
  - `src/styles/global.css` :: 문서 스크롤 규칙 — read-only; 기존 `body`에 `overflow: hidden` 없음

#### Details

- **Data & Schema Fields**: CSS에서 플레이 화면의 내부(content box) 크기를 `1240px × 840px`, 테두리를 사방 `5px`로 고정한다. 전체 게임틀 외형은 `1250px × 850px`다. `.screen`의 최대 border-box 너비는 `1282px` (`1250 + 16×2` 패딩)로 맞춘다.
- **Execution Flow / Logic**:
  1. `.viewport`를 `width: 1240px; height: 840px; box-sizing: content-box`로 설정한다. `overflow: hidden`은 미로 카메라 클리핑 용도로 유지한다. `width: 100%`, `height: min(88vh, 840px)`, 반응형 높이·테두리 두께 변경은 제거한다. 모바일의 둥근 모서리 표현은 유지할 수 있다.
  2. `.screen`은 창 너비를 넘지 않는 기존 반응형 너비와 패딩을 유지하되 최대 너비를 `1282px`로 늘려 넓은 창에서 게임틀을 중앙에 둔다. `.playfield`는 `width: max-content`로 내부 게임틀의 `1250px`를 포함해 일시정지·결과 오버레이의 `inset: 0` 범위가 전체 틀과 일치하도록 한다.
  3. 창이 `1282px`보다 좁아지면 고정 `.playfield`가 문서 너비보다 넓어져 문서가 가로로 스크롤된다. 창이 낮으면 문서가 세로로 스크롤된다. `.viewport`의 `touch-action: none`은 제거해 터치 시작점이 게임틀 위여도 페이지를 밀어 이동할 수 있게 한다. 새 내부 스크롤 영역이나 보드 CSS `scale`/`zoom`은 도입하지 않는다.
- **Error & Exception Handling**: `overflow: hidden`은 미로 뷰포트에만 적용하고 문서·`.screen`·`.playfield`에 적용하지 않는다. 게임틀 오른쪽·아래쪽, 일시정지 버튼과 방향 버튼이 스크롤로 접근 가능한지 확인한다.
- **Tests**: 실제 브라우저에서 넓은 창(예: `1366×900`)과 작은 창(예: `390×844`, `844×390`)을 비교한다. 게임틀 content box `1240×840`, 플레이어·타일 픽셀 크기와 보이는 맵 칸 수는 같아야 한다. 작은 창에서 가로·세로 문서 스크롤이 가능하고 게임틀 경계와 일시정지 오버레이가 일치해야 한다. 일시정지/재개와 방향 버튼 입력을 확인한다.

## Acceptance Criteria

- [ ] 창 크기 변화가 `--cell-size: 140px`, 플레이어 표시 상자 `224px`, 내부 시야 `1240×840px`를 바꾸지 않는다.
- [ ] 같은 플레이어 위치의 카메라 오프셋과 맵 끝 제한이 창 크기와 무관하게 같다.
- [ ] 작은 창에서 페이지 스크롤로 전체 게임틀·오버레이·조작 버튼에 접근할 수 있고, 게임 내부가 축소되거나 추가로 잘리지 않는다.
- [ ] 이동·충돌·구출·일시정지·모션 감소 기존 동작과 타입 검사·빌드가 통과한다.

## Validation

- `npm.cmd test -- --run` — 전체 Vitest 회귀 테스트 통과
- `npm.cmd run lint` — TypeScript 검사 통과
- `npm.cmd run build` — 프로덕션 빌드 통과
- `npm.cmd run dev -- --host 127.0.0.1`로 로컬 화면을 띄워 넓은/작은 창에서 실제 크기·페이지 스크롤·오버레이를 확인

## Commit Message

```text
fix(maze): 창 크기와 무관하게 게임 시야 고정

Plan: 2026-10-01-fixed-maze-view
Phase: P01-fixed-viewport
Task: T01-lock-maze-viewport

- 게임 내부 시야와 타일·플레이어 크기를 1240×840 기준으로 고정
- 작은 창의 페이지 스크롤과 카메라·오버레이 범위 검증
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (전체 테스트 106개, TypeScript 검사, 프로덕션 빌드, diff 검사)
- commit: Git 기록 참조
- 브라우저 시각 검증은 Windows UI 도구의 런타임 파일 오류와 로컬 헤드리스 브라우저 실행 실패로 수행하지 못했다. 작은 창의 실제 스크롤과 오버레이 배치는 코드 구조로 확인했고, 실기기 확인은 남아 있다.
- `.memory/`는 `.gitignore` 대상이다. 아직 추적되지 않은 이 Task 파일은 커밋 때 `git add -f`로 스테이징한다.
