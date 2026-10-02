# Task: T01 창 높이에 맞추는 고정 시야 맵틀

## Status: done

## Goal

게임 맵틀 배율을 창 너비와 HUD·조작 UI를 제외한 남는 높이로 계산하여 `1440×900px`에서 세로 스크롤 없이 플레이할 수 있게 한다. 창을 바꿔도 내부 시야는 약 `10.33×7`칸으로 유지한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-laptop-fit-fixed-maze-view.md): `1440×900px`에서 세로 스크롤 없음. 배율은 가로·세로의 더 제한적인 값. 아주 낮은 창에서만 조작 접근을 위한 세로 스크롤 허용.
- 이전 [가로폭 결정](../../../decisions/2026-10-02-full-width-fixed-maze-view.md)의 높이와 무관한 가로폭 최대화 규칙은 이 Task에서 대체한다. 타일 기준 120px 및 `600px` 이하 모바일 버튼은 유지한다.

## Implementation

### I01. 너비와 남는 높이로 배율 측정

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, `sceneScale`, `playfieldAreaRef`, `useLayoutEffect.measure` — modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.controlsArea` — modify
  - `src/components/Hud/GameHud.tsx` :: HUD 루트 `<header>` — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  const BASE_FRAME_WIDTH = 1250
  const BASE_FRAME_HEIGHT = 850
  const screenRef = useRef<HTMLDivElement>(null)
  const playfieldAreaRef = useRef<HTMLDivElement>(null)
  const controlsAreaRef = useRef<HTMLDivElement>(null)
  const widthScale = areaRect.width / BASE_FRAME_WIDTH
  const availableHeight = window.innerHeight
    - (areaRect.top - screenRect.top)
    - controlsRect.height
    - Number.parseFloat(getComputedStyle(screen).paddingBottom)
  const heightScale = availableHeight / BASE_FRAME_HEIGHT
  const next = Math.max(0.1, Math.min(widthScale, heightScale))
  ```
- **Data & Schema Fields**: `sceneScale: number`은 표시 전용 React state. 새 prop, 게임 상태, 저장 스키마 필드 없음. refs는 DOM 측정 전용이며 저장하지 않는다.
- **Execution Flow / Logic**:
  1. `.screen`, `.playfieldArea`, `.controlsArea`의 `getBoundingClientRect()`를 측정한다. `areaRect.top - screenRect.top`은 HUD와 위쪽 padding을 포함하며, 문서 스크롤 위치에 영향받지 않는다. CSS `paddingBottom`과 `controlsRect.height`를 빼 맵틀의 가용 높이를 구한다.
  2. 가용 너비/1250과 남은 높이/850 중 작은 배율을 적용한다. `.playfield` 너비와 높이에 기존처럼 1250·850을 곱한다. `.playfieldArea`의 중앙 정렬을 유지한다. 0 이하·`NaN`·무한대인 필수 DOM 측정값은 무시한다. 극단적으로 낮은 창에는 `0.1` 배율 하한을 적용하여 0px 맵틀을 피하고 문서 세로 스크롤을 허용한다.
  3. `ResizeObserver`가 있으면 `.playfieldArea`, `.controlsArea`, `.screen`의 첫 자식인 HUD `<header>`를 관찰한다. HUD 경고 배지나 모바일 UI가 줄바꿈으로 높이가 변해도 다시 측정한다. `window.resize`는 observer가 있어도 등록하여 너비가 같고 높이만 변한 창에도 반응한다. 언마운트 시 모두 정리하고 동일 배율에는 state를 다시 설정하지 않는다.
  4. 데스크톱 `.controlsArea`에 `min-height: 50px`을 적용해 `ready`의 시작 버튼이 사라져도 맵틀 배율이 갑자기 커지지 않게 한다. `600px` 이하 방향 버튼의 실제 높이는 이 값보다 크다. 버튼의 표시·동작은 변경하지 않는다.
- **Error & Exception Handling**: 요소가 아직 없거나 측정값이 유효하지 않으면 기존 `sceneScale`을 유지한다. 폰트·HUD 경고·모바일 줄바꿈으로 UI가 높아지면 다시 맞춘다. 매우 낮은 창에서는 UI를 자르지 않는다.

### I02. 크기 변화와 게임 동작 검증

- Related Files:
  - `src/components/GameScreen/GameScreen.test.tsx` :: 첫 배율·resize 테스트 — modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 타일·카메라 비율 테스트 — read-only
  - `src/components/Controls/DirectionControls.module.css` :: `600px` 경계 — read-only
  - `src/components/Overlays/Overlays.module.css` :: 고정 overlay — read-only

#### Details

- **Signatures & Types**: `getBoundingClientRect()`의 `.screen` top, `.playfieldArea` width/top, `.controlsArea` height를 모의하고 `window.innerHeight`를 바꾸며 `resize` 이벤트를 발생시킨다. `ResizeObserver` 유무는 기존 테스트 방식과 같이 제어한다.
- **Data & Schema Fields**: 게임 state·좌표·저장 필드 변경 없음.
- **Execution Flow / Logic**:
  1. `1440×900px`에 해당하는 area width `1408`, area relative top `86`, controls height `50`, bottom padding `8`일 때 heightScale=`756/850`; frame은 약 `1111.76×756`이며 widthScale=`1408/1250`보다 작다. 실제 브라우저에서는 문서 스크롤 높이가 viewport 이하인지 확인한다.
  2. 너비 625에 가용 높이가 넉넉하면 frame `625×425`, tile `60px`; 넓은 화면의 높이를 줄이면 frame이 높이에 비례해 축소되는지 확인한다. **너비는 같고 창 높이만 바뀌어도** frame이 바뀌어야 한다. 플레이어 row/col과 게임 상태 변경 콜백 수는 resize로 바뀌면 안 된다.
  3. 실제 브라우저에서 `1440×900`, `1366×768`, `1843×900`, `390×844`, `844×390`의 맵틀·내부 시야·가로 스크롤 부재·준비 버튼·모바일 방향 버튼을 확인한다. `1440×900`에서는 세로 스크롤 없음과 일시정지·결과 팝업 접근을 확인한다.
- **Error & Exception Handling**: 테스트의 0 크기 모의값과 실제 높이 변경을 구분한다. 기존 너비 전용 기대값을 새 규칙에 맞춘다.

## Acceptance Criteria

- [x] `1440×900px` 게임 페이지에서 맵틀·HUD·시작 버튼이 한 화면 안에 있고 세로/가로 스크롤이 없다.
- [x] 창 너비와 높이 변경에 따라 맵틀이 같은 비율로 변하며 좌우 남는 공간에 중앙 정렬된다.
- [x] 검증 창에서 내부 시야 약 `10.33×7`칸, 타일·플레이어 비율과 카메라 이동이 유지된다.
- [x] 캠페인 제목, 게임 제목 숨김, 모바일 방향 버튼, 키보드 입력, 일시정지·결과 팝업 접근성이 유지된다.
- [x] 전체 테스트·lint·빌드 및 실제 브라우저 확인이 통과한다.

## Validation

- `npm.cmd test -- --run --maxWorkers=2` — 전체 Vitest 회귀 테스트.
- `npm.cmd run lint` — 타입·린트 검사.
- `npm.cmd run build` — 프로덕션 빌드.
- `npm.cmd run dev -- --host 127.0.0.1` — Chrome에서 위 다섯 창 크기와 시야·스크롤·버튼·팝업 확인.

## Commit Message

```text
feat(maze): 노트북 높이에 맞춰 맵틀 자동 축소

Plan: 2026-10-02-laptop-fit-fixed-maze-view
Phase: P01-viewport-fit
Task: T01-fit-frame-to-viewport

- 창 너비와 남는 높이를 함께 반영해 맵틀 배율 계산
- 고정 시야와 노트북 무스크롤 레이아웃 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 전체 테스트 107개, lint, build, Chrome 1440×900·1366×768·1843×900·390×844·844×390, 일시정지·시간 초과 팝업
- commit: 이 Task의 구현 커밋 (`git log` 참조)

- `.memory/`는 `.gitignore` 대상이므로 이 Task 파일은 `git add -f`로 명시적으로 스테이징한다.
