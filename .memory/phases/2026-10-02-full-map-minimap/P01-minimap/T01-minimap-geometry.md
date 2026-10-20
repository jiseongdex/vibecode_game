# Task: T01 미니맵 좌표와 벽 선분 계산

## Status: done

## Goal

기존 미로 벽과 확대 그리드의 동물·탈출구 위치, `MazeBoard`가 계산한 실제 카메라 시야를 미니맵 좌표로 변환하는 순수 함수들을 만들고 검증한다. 화면 코드가 카메라 수식과 벽 중복 제거 규칙을 다시 구현하지 않게 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-full-map-minimap.md): 전체 지형을 처음부터 공개하고 벽을 선으로 간소화하며, 현재 시야를 테두리와 바깥 음영으로 표시한다. 플레이어 마커는 없다.
- 현행 보드는 `visualSize(size) = size * 2 + 1`인 확대 그리드를 쓴다. `GameState.exit`과 `rescues`의 `row/col`은 이미 확대 그리드 좌표다.
- `MazeBoard`의 실제 `cameraOffset` 결과를 입력으로 받는다. 타일 기준값이나 화면 배율을 이 모듈에 복제하지 않는다.

## Implementation

### I01. 벽 선분 및 마커 투영

- Related Files:
  - `src/components/MazeBoard/minimapGeometry.ts` :: `getMinimapWallSegments`, `projectGridCenter`, `MinimapWallSegment`, `MinimapMarkerPercent` — new
  - `src/components/MazeBoard/boardGeometry.ts` :: `closedWallSlots`, `visualSize` — read-only
  - `src/game/types.ts` :: `Maze`, `Position` — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export interface MinimapWallSegment {
    key: string
    x1: number
    y1: number
    x2: number
    y2: number
  }
  export interface MinimapMarkerPercent {
    leftPercent: number
    topPercent: number
  }
  export function getMinimapWallSegments(maze: Maze): MinimapWallSegment[]
  export function projectGridCenter(position: Position, boardTiles: number): MinimapMarkerPercent
  ```
- **Data & Schema Fields**: `MinimapWallSegment`의 좌표는 `0..visualSize(maze.size)` SVG viewBox 단위이고 `key`는 확대 그리드 벽 슬롯의 `${position.row}:${position.col}`이다. `MinimapMarkerPercent`의 두 숫자는 `0..100` 범위 CSS 위치 퍼센트다. `GameState`와 저장 스키마는 수정하지 않는다.
- **Execution Flow / Logic**:
  1. `getMinimapWallSegments`는 기존 `closedWallSlots(maze)`를 사용한다. 이 함수는 각 미로 셀의 `top`·`left` 벽과 바깥 경계의 `right`·`bottom`만 한 번씩 반환하므로 내부 공유 벽을 중복해서 그리지 않는다. 열린 통로는 선분을 만들지 않는다.
  2. 수평 벽(`side === 'up' || side === 'down'`)의 확대 그리드 슬롯 `(row, col)`을 `x1=col-0.5`, `x2=col+1.5`, `y1=y2=row+0.5`로 변환한다. 수직 벽은 `x1=x2=col+0.5`, `y1=row-0.5`, `y2=row+1.5`로 변환한다. 이 선분들은 인접 벽 접점에서 만나며 `viewBox="0 0 boardTiles boardTiles"`에 맞는다. 장애물 이미지·테마 변종은 읽지 않는다.
  3. `projectGridCenter`는 확대 그리드 위치를 `leftPercent=(col+0.5)/boardTiles*100`, `topPercent=(row+0.5)/boardTiles*100`으로 변환한다. `boardTiles`는 양의 정수, `row/col`은 `0 <= 값 < boardTiles`인 정수여야 한다.
- **Error & Exception Handling**: `projectGridCenter`의 크기나 좌표가 범위를 벗어나거나 정수가 아니면 `RangeError`를 던진다. 게임에서 생성되는 좌표는 유효하므로 정상 렌더링에서 예외가 나지 않아야 한다. 미로 벽 입력은 기존 `Maze` 불변식을 따른다.
- **State Transition & Return**: 세 함수 모두 입력을 변경하지 않고 새 값만 반환한다. 이 구현 단위는 렌더 상태를 만들지 않는다.

### I02. 실제 카메라 시야 투영

- Related Files:
  - `src/components/MazeBoard/minimapGeometry.ts` :: `CameraFrame`, `MinimapViewportBounds`, `getMinimapViewportBounds` — new
  - `src/components/MazeBoard/MazeBoard.tsx` :: `cameraOffset`, `cellSize`, `viewWidth`, `viewHeight`, `offsetX`, `offsetY` — read-only in T01

#### Details

- **Signatures & Types**:
  ```typescript
  export interface CameraFrame {
    boardTiles: number
    cellSize: number
    viewWidth: number
    viewHeight: number
    offsetX: number
    offsetY: number
  }
  export interface MinimapViewportBounds {
    left: number
    top: number
    right: number
    bottom: number
  }
  export function getMinimapViewportBounds(frame: CameraFrame): MinimapViewportBounds
  ```
- **Data & Schema Fields**: 경계 네 값은 전체 지도 너비·높이에 대한 `0..1` 정규화 수치다. CSS 퍼센트는 T02에서 `*100`으로 만든다. 저장 필드가 아니다.
- **Execution Flow / Logic**:
  1. `boardPixels = boardTiles * cellSize`로 축별 실제 보드 길이를 구한다. 보드는 정사각형이므로 같은 값을 X/Y에 사용한다.
  2. `clamp(v) = Math.max(0, Math.min(1, v))`를 사용한다. `left=clamp(-offsetX/boardPixels)`, `right=clamp((viewWidth-offsetX)/boardPixels)`, `top=clamp(-offsetY/boardPixels)`, `bottom=clamp((viewHeight-offsetY)/boardPixels)`를 반환한다.
  3. 시작·중앙·끝 카메라뿐 아니라 보드가 뷰포트보다 작아서 `cameraOffset`이 양수인 경우도 `0..1` 전체 범위로 제한한다. 동일한 보드와 뷰포트를 같은 배율로 조정하면 정규화 시야는 바뀌지 않는다.
- **Error & Exception Handling**: `boardTiles`는 양의 정수, `cellSize`·`viewWidth`·`viewHeight`는 finite 양수, `offsetX/Y`는 finite 숫자인지 검사하고 위반 시 `RangeError`를 던진다. `MazeBoard`는 유효하지 않은 `scale`을 이미 `1`로 대체한다.
- **State Transition & Return**: 입력 카메라 값을 변경하지 않고 새 경계 객체를 반환한다.

### I03. 계산 회귀 테스트

- Related Files:
  - `src/components/MazeBoard/minimapGeometry.test.ts` :: `describe('minimapGeometry')` — new
  - `src/game/mazeGenerator.ts` :: `generateMaze`, `createSeededRandom` — read-only test fixture

#### Details

- **Test Cases**:
  1. 크기 2의 손수 만든 `Maze`에서 셀 벽 `{top,right,bottom,left}`을 `(0,0)={true,false,false,true}`, `(0,1)={true,true,true,false}`, `(1,0)={false,false,true,true}`, `(1,1)={true,true,true,false}`로 놓고 `visited:true`, `seed:1`을 넣는다. 바깥 여덟 선과 `(0,1)`↔`(1,1)` 사이 내부 닫힌 선 총 9개가 그려지는지, 열린 공유 벽에는 선분이 없는지, 중복 키가 없는지 확인한다. 추가로 생성된 15칸 미로의 선분 수가 `closedWallSlots(maze).length`와 같고 모든 끝점이 `0..visualSize(size)` 안인지 확인한다.
  2. 확대 그리드의 `(row:1,col:1)`과 마지막 셀 중심 위치를 퍼센트로 투영하고, 크기·좌표 오류에서 `RangeError`를 확인한다.
  3. `boardTiles=31`, `cellSize=108`, `viewWidth=1240`, `viewHeight=840`에서 시작 `(offsetX:0,offsetY:0)`, 중앙 `(-730,-930)`, 끝 `(-2108,-2508)`의 경계를 공식과 `toBeCloseTo`로 확인한다. 모든 입력 길이·오프셋을 0.5배 한 결과가 동일한지도 확인한다.
  4. 보드가 뷰포트보다 작고 중앙 정렬된 경우 결과가 `{left:0,top:0,right:1,bottom:1}`인지와 invalid 입력 `RangeError`를 확인한다.

## Acceptance Criteria

- [x] 벽 선분이 닫힌 벽만 한 번씩 표시할 좌표로 변환되고 열린 통로에는 선분이 없다.
- [x] 동물·탈출구 확대 그리드 좌표가 전체 지도 내 정확한 퍼센트 위치로 변환된다.
- [x] 시작·중앙·끝·축소 배율·작은 보드에서 실제 카메라 시야 경계가 `0..1` 안에 정확히 들어온다.
- [x] T01만 구현해도 타입 검사와 지정된 단위 테스트가 통과한다.

## Validation

- `npm.cmd test -- --run src/components/MazeBoard/minimapGeometry.test.ts` — 선분·좌표·카메라 계산 테스트 통과.
- `npm.cmd run lint` — TypeScript 검사 통과.

## Commit Message

```text
feat(minimap): 미로와 카메라 좌표 투영 함수 추가

Plan: 2026-10-02-full-map-minimap
Phase: P01-minimap
Task: T01-minimap-geometry

- 닫힌 벽을 SVG 선분으로 변환하고 동물·출구 좌표를 투영
- 실제 카메라 시야의 정규화 경계를 계산하고 단위 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — Vitest 5개, `npm.cmd run lint`
- commit: 이 Task의 구현 커밋 (`git log` 참조)
