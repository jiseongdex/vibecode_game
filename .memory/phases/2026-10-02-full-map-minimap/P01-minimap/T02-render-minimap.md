# Task: T02 전체 지도 렌더링과 맵 틀 통합

## Status: done

## Goal

맵 틀 오른쪽 하단에 읽기 전용 전체 미니맵을 표시한다. 시작부터 전체 벽을 선으로, 미구조 동물과 탈출구를 마커로 표시하고, 실제 카메라 시야 테두리 밖만 옅게 어둡게 한다. 구조·이동·화면 배율 변화가 즉시 반영되어야 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-full-map-minimap.md): 전체 지형과 마커는 처음부터 보이고, 구조된 동물과 플레이어 점은 보이지 않는다. 미니맵은 클릭·드래그로 시야를 이동시키지 않는다.
- T01의 `getMinimapWallSegments`, `projectGridCenter`, `getMinimapViewportBounds`를 사용한다. 기존 `MazeBoard`의 카메라·타일·뷰포트 계산값을 재사용하며 게임 상태와 저장 스키마는 건드리지 않는다.
- 일시정지·결과 팝업은 현재 `Overlays.module.css`에서 `position:fixed; z-index:10`이므로 미니맵의 쌓임 순서는 그 아래여야 한다.

## Implementation

### I01. 전체 지도 시각화 컴포넌트

- Related Files:
  - `src/components/MazeBoard/MiniMap.tsx` :: `MiniMap`, `MiniMapProps` — new
  - `src/components/MazeBoard/MiniMap.module.css` :: `.minimap`, `.map`, `.walls`, `.wallLine`, `.shade`, `.animal`, `.exit`, `.viewOutline` — new
  - `src/components/MazeBoard/minimapGeometry.ts` :: T01의 세 투영 함수와 `MinimapViewportBounds` — read-only
  - `src/game/gameState.ts` :: `RescueTarget` — read-only
  - `src/game/types.ts` :: `Maze`, `Position` — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export interface MiniMapProps {
    maze: Maze
    rescues: readonly RescueTarget[]
    exit: Position
    viewport: MinimapViewportBounds
  }
  export function MiniMap(props: MiniMapProps): ReactElement
  ```
  `ReactElement`는 `react`에서 타입으로 import한다.
- **Data & Schema Fields**: `RescueTarget`은 기존 `{id:string,row:number,col:number,rescued:boolean}`이다. `exit`은 확대 그리드의 `{row:number,col:number}`다. `viewport`는 전체 지도 기준 `left/top/right/bottom` 정규화 수치다. 컴포넌트 내부 저장 상태나 새 영속 필드는 없다.
- **Execution Flow / Logic**:
  1. `boardTiles=visualSize(maze.size)`를 구한다. `getMinimapWallSegments(maze)`를 `useMemo([maze])`로 계산한다. 한 개의 `<svg viewBox={`0 0 ${boardTiles} ${boardTiles}`}>` 안에 선분별 `<line>`을 렌더한다. 각 선분은 `key`를 사용하고, `vector-effect: non-scaling-stroke`인 가는 단색 선을 사용한다. 기존 장애물 이미지와 바닥 텍스처는 미니맵에 복제하지 않는다.
  2. `rescues.filter(target => !target.rescued)`만 원형 동물 마커로 렌더한다. `projectGridCenter(target,boardTiles)`의 `leftPercent/topPercent`로 `.map` 안에 절대 배치한다. `exit`은 같은 방식의 형태·색이 다른 마커로 항상 표시한다. `followers`는 prop에 없고 마커도 만들지 않는다. 플레이어 마커도 만들지 않는다.
  3. `viewport`에서 `left/top/width=(right-left)/height=(bottom-top)`을 `*100%`로 바꾼다. 같은 범위에 `.viewOutline` 테두리를 배치한다. 네 개의 `.shade` 사각형으로 바깥만 덮는다: 위쪽 `[0,top]` 전체 폭, 아래쪽 `[bottom,1]` 전체 폭, 왼쪽 `[0,left]×[top,bottom]`, 오른쪽 `[right,1]×[top,bottom]`. 음영은 벽 SVG 위, 동물·출구 마커 아래에 배치해 시야 밖 마커도 읽을 수 있게 한다. 시야 안쪽에는 음영을 넣지 않는다.
  4. 전체 지도 컨테이너는 `role="region"`, `aria-label="전체 미니맵, 구조할 동물 N마리와 탈출구"`, `data-testid="minimap"`을 갖는다. 세부 장식 SVG·음영·마커는 `aria-hidden="true"`로 중복 낭독을 막는다. 동물 마커에는 `data-minimap-animal={target.id}`, 출구에 `data-testid="minimap-exit"`, 시야 테두리에 `data-testid="minimap-viewport"`, 네 음영에 각 `data-testid="minimap-shade-top|bottom|left|right"`를 부여해 회귀 테스트가 상태를 확인할 수 있게 한다.
  5. 미니맵 전체는 `pointer-events:none`으로 플레이 조작을 가로채거나 클릭·드래그 이동 기능을 제공하지 않는다. 지도의 퍼센트 좌표는 SVG와 같은 정사각형 `.map` 안쪽을 기준으로 한다.
- **Styling**: `.minimap`은 `position:absolute; right:clamp(6px,1.5%,18px); bottom:clamp(6px,1.5%,18px); width:clamp(88px,24%,240px); box-sizing:border-box; z-index:1; padding:6px; border:2px solid var(--color-border); border-radius:12px; background:var(--color-paper); pointer-events:none`을 기본으로 한다. `.map`은 `position:relative; width:100%; aspect-ratio:1; overflow:hidden`이다. 벽은 `var(--color-wall)`의 약 1px 화면 선, 바깥 음영은 `rgb(36 52 43 / 22%)`, 시야 테두리는 약 2px `var(--color-focus)`로 시작하고 실제 화면에서 색 대비만 조정한다. 마커는 동물 원 약 6px, 출구 구분형 약 7px로 만들며 화면 크기와 무관하게 알아볼 수 있게 한다. 미니맵 `z-index:1`은 고정 팝업 `z-index:10`보다 낮다.
- **Error & Exception Handling**: 빈 `rescues`에서는 동물 마커만 0개이고 탈출구·시야는 유지한다. 음영 너비나 높이가 0인 경계에서는 0% 사각형을 허용한다. T01 함수가 유효하지 않은 좌표를 거부하므로 여기서는 생성된 `GameState`를 입력으로 사용한다.
- **State Transition & Return**: prop이 바뀌면 React가 재렌더한다. 별도 이벤트 핸들러, 타이머, 영속 상태, 카메라 변경은 없다.

### I02. 실제 맵 틀 안에 배치

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`, 기존 `offsetX`, `offsetY`, `cellSize`, `viewWidth`, `viewHeight`, `boardTiles`, `.viewport` JSX — modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport`, `.board` — read-only unless stacking regression requires a focused adjustment
  - `src/components/Overlays/Overlays.module.css` :: `.overlay` — read-only

#### Details

- **Signatures & Types**:
  ```tsx
  const viewport = getMinimapViewportBounds({
    boardTiles, cellSize, viewWidth, viewHeight, offsetX, offsetY,
  })
  <MiniMap maze={state.maze} rescues={state.rescues} exit={state.exit} viewport={viewport} />
  ```
- **Data & Schema Fields**: 기존 `MazeBoardProps`와 `GameState`는 변경하지 않는다. `MazeBoard` 안의 `offsetX/Y`는 기존 `cameraOffset`의 결과로 이미 배율과 끝점 제한을 포함한다.
- **Execution Flow / Logic**:
  1. 기존 카메라 offset 두 값을 계산한 직후 T01의 `getMinimapViewportBounds`로 시야를 구한다.
  2. `<MiniMap>`을 `.board`의 **자식이 아닌** `div.viewport`의 두 번째 자식으로, `.board` 뒤에 배치한다. 그래야 맵과 함께 이동하지 않고 틀 오른쪽 하단에 고정된다. 기존 `MazeBoard`의 맵, 스프라이트, 입력 prop은 유지한다.
  3. 맵 틀은 `position:relative; overflow:hidden`이므로 별도 래퍼나 `GameScreen` 수정 없이 절대 위치를 기준으로 쓸 수 있다. 보드의 transform stacking context 위에 보이되 고정 일시정지·결과 팝업 아래에 놓는다.
- **Error & Exception Handling**: `scale`이 유효하지 않을 때 `MazeBoard`가 기존처럼 1로 보정한다. 미니맵 시야도 보정된 `cellSize/viewWidth/viewHeight/offsetX/Y`만 받아야 한다. 화면이 좁아져도 맵 틀 밖으로 넘치거나 플레이어 이동을 막지 않아야 한다.
- **State Transition & Return**: 게임 상태 변경 없이 시각적 파생값만 렌더한다.

### I03. 미니맵 및 회귀 검증

- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `describe('MazeBoard')`의 단계별 렌더, 구조 상태, 카메라 이동·배율 테스트 — modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: 키보드·일시정지·재시도 흐름 — read-only

#### Details

- **Test Cases**:
  1. 첫 번째 단계별 렌더 테스트의 `queryByRole('region', {name:/미니맵/}).toBeNull()`을 존재 단언으로 교체한다. 크기 15와 33 양쪽에서 지도 영역이 `maze-viewport`의 직접 자식이고 `maze-board`의 자식은 아닌지, 벽 선 수가 `closedWallSlots(state.maze).length`인지, 미구조 마커 수가 `rescueCount`인지, 탈출구 마커가 하나인지 확인한다. 미니맵 안에는 플레이어 표식이 없어야 한다.
  2. 기존 구조 상태 테스트에서 rerender 후 해당 동물 마커가 사라지고 따라오는 동물의 새 마커가 생기지 않으며 탈출구는 유지되는지 확인한다. 모든 동물을 구조해도 지도와 출구는 남는다.
  3. 기존 카메라 이동 테스트의 시작·중앙·끝 위치에서 `minimap-viewport`의 `left/top/width/height` 퍼센트를 실제 값 `(0,0)`, `(-730,-930)`, `(-2108,-2508)`과 `boardTiles=31`, `cellSize=108`, `viewWidth=1240`, `viewHeight=840`에서 산출한 기대값으로 확인한다. 바깥 네 음영 영역이 그 경계와 맞고 시야 안에는 음영이 없는 DOM 배치를 확인한다.
  4. 기존 배율 테스트에서 `scale=0.5`와 `1.28`로 바꿔도 지도 시야 퍼센트와 마커 퍼센트가 일정하고, 맵 틀 내부에 남는지 확인한다. 실제 CSS 크기·색 대비·시야 밖 마커 식별성은 대표 데스크톱 `1366×900`과 모바일 `390×844`, 작은 단계와 마지막 단계에서 브라우저로 확인한다.
  5. 전체 회귀 테스트에서 이동·일시정지·결과 팝업, 구조, 저장 관련 기존 동작이 통과해야 한다. 미니맵의 `pointer-events:none`과 팝업 위로 올라오지 않는 쌓임 순서를 시각 확인한다.

## Acceptance Criteria

- [x] 맵 틀 오른쪽 하단의 읽기 전용 미니맵이 15칸·33칸 미로 전체를 선으로 표시한다.
- [x] 구조 전 동물과 탈출구는 시작부터 보이고, 구조한 동물·따라오는 동물·플레이어 점은 표시하지 않는다.
- [x] 실제 카메라 시야 테두리가 이동·경계 제한·화면 배율을 따르고, 테두리 밖만 옅게 어두우며 바깥 마커도 식별된다.
- [x] 작은 화면에서도 미니맵은 맵 틀 안에 남고 플레이 입력과 일시정지·결과 팝업을 방해하지 않는다.
- [x] 지정 테스트, 전체 회귀 테스트, 타입 검사, 프로덕션 빌드가 통과한다.

## Validation

- `npm.cmd test -- --run src/components/MazeBoard/minimapGeometry.test.ts src/components/MazeBoard/MazeBoard.test.tsx` — 미니맵 계산·렌더·구조·시야 테스트 통과.
- `npm.cmd test -- --run --maxWorkers=2` — 전체 회귀 테스트 통과.
- `npm.cmd run lint` — TypeScript 검사 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- `npm.cmd run dev -- --host 127.0.0.1` — 가능한 브라우저에서 `1366×900`, `390×844`, 단계 1·20의 맵 틀 내 배치·마커·음영·팝업을 시각 확인한다. 브라우저를 사용할 수 없으면 그 사실과 미검증 화면 항목을 실행 결과에 남긴다.

## Commit Message

```text
feat(minimap): 맵 틀에 전체 지도와 시야 표시 추가

Plan: 2026-10-02-full-map-minimap
Phase: P01-minimap
Task: T02-render-minimap

- 선형 벽 지도와 미구조 동물·탈출구 마커를 표시
- 카메라 시야 테두리와 바깥 음영을 맵 틀에 통합하고 회귀 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 표적 테스트 28개, 전체 회귀 116개, `npm.cmd run lint`, `npm.cmd run build`, 개발 서버 HTTP 200.
- 브라우저 제어 도구에 연결된 브라우저가 없어 `1366×900`·`390×844` 실제 화면의 크기·대비·팝업 겹침 육안 검사는 수행하지 못했다. CSS와 DOM 계산 및 회귀 테스트로 확인한 범위와 구분한다.
- commit: 이 Task의 구현 커밋 (`git log` 참조)
