# Task: T02 확장 격자 렌더링과 투명 출구

## Status: done

## Goal
T01에서 정한 2N+1 런타임 좌표를 보드에 그대로 렌더링해 플레이어와 follower의 한 번 이동이 화면의 인접 타일 한 칸으로 보이게 한다. 열린 통로 칸을 시각적으로 바닥과 연결하고, 캐릭터 크기 및 출구 이미지 투명도를 유지한다.

## Decision Summary
- 원본 미로 셀은 홀수/홀수 타일에 표시하고 벽 없는 연결 타일만 이동 가능한 바닥처럼 표현한다. 짝수/짝수 교차점은 장식 및 차단 타일로 남긴다.
- 플레이어와 동물 크기는 작은 렌더 칸의 140%(원래 큰 바닥 칸의 70%)다. 출구 이미지와 컨테이너 배경은 투명하게 두며 기존 잠김/해제 효과를 보존한다.

## Implementation

### I01. 확장 격자의 보드 레이아웃 및 카메라

- Related Files:
  - `src/components/MazeBoard/boardGeometry.ts` :: `visualSize`, `visualCell`, `visualWall`, `closedWallSlots` — 보드 기하와 논리 좌표 변환; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `cameraOffset`, `MazeBoard`, `MotionSnapshot` — 타일 생성 및 카메라 추적; modify
  - `src/components/MazeBoard/MazeCell.tsx` :: `MazeCell` — 논리 셀을 홀수/홀수 위치에 렌더; modify
  - `src/components/MazeBoard/MazeWall.tsx` :: `WallLayer` — 벽 및 교차점 차단 시각 표현; inspect, modify only if needed
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.board`, `.cell`, `.wallLayer` and connector rules — 연결 칸 바닥 배경; modify
- **Signatures & Types**:
  ```ts
  export function visualSize(mazeSize: number): number
  export function visualCell(position: Position): Position
  export function visualWall(position: Position, side: Direction): Position
  export function closedWallSlots(maze: Maze): WallSlot[]
  export interface MazeBoardProps {
    state: GameState
    onMove: (direction: Direction) => void
    appearance?: PlayerAppearance
    movementAttempt?: number
  }
  ```
- **Execution Flow / Logic**:
  1. `visualSize(N)` remains `2*N+1`. `MazeCell` logical `(r,c)` uses render `(2r+1,2c+1)`. Runtime `state.player` and `state.followers` are already render coordinates and must not be passed through `visualCell` again.
  2. Camera centers on `state.player` render row/col directly. Each CSS grid slot remains one small render tile; preserve the existing total board pixel width by using `cellSize = floor(logicalCellSize/2)`.
  3. For each connector between two logical cells, determine walkability using T01's exact rule: horizontal connector is open iff the left cell's `walls.right` is false; vertical connector iff the upper cell's `walls.bottom` is false. Open connectors receive the active theme floor color and a deterministic floor texture. Closed connectors retain wall artwork. Every even/even junction remains blocked and uses current junction decoration.
  4. The player marker is positioned by render `(row,col)` and remains a single stable DOM root. Preserve preloaded image sources and motion snapshots. Animate only the position transition; direction image changes must not remount root or flash.
- **Tests**: verify board grid is 2N+1, logical cell centers use odd coordinates, player camera and marker use direct render coordinates, connector background is floor iff passage is open, wall slots/junctions remain blocked, and CSS size keeps small tile scale.

### I02. 플레이어, rescue 및 follower 위치/크기

- Related Files:
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSpriteProps`, `PlayerSprite` — 확장 좌표와 보간 위치; modify
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSpriteProps`, `RescueSprite` — follower 절대 위치와 hopping; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard` — 목표/동물을 board overlay로 배치; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.sprite`, `.playerSprite`, `.rescueSprite`, `.followerSprite` — 정렬/크기; modify
- **Signatures & Types**:
  ```ts
  interface PlayerSpriteProps {
    appearance?: PlayerAppearance
    facing: Direction
    position: Position // expanded-grid coordinate
    cellSize: number
    movementAttempt: number
    animateMove: boolean
  }
  interface RescueSpriteProps {
    animalId: string
    position: Position // expanded-grid coordinate
    cellSize: number
    facing?: Direction
    following?: boolean
    order?: number
    movementAttempt?: number
    animateMove?: boolean
  }
  ```
- **Execution Flow / Logic**:
  1. Player top-left translation is `((position.col - 0.7) * cellSize, (position.row - 0.7) * cellSize)` for sprite width/height `1.4 * cellSize`. Thus sprite center aligns to tile center and occupies 70% of original logical floor tile.
  2. RescueSprite receives explicit `position` and `cellSize`; apply the same top-left translation for both static rescue targets and followers. Keep only target/follower actors in board overlay when their positions match. Keep rescued targets filtered out; use rescued target id by follower order for the existing animal appearance.
  3. Use stable sprite root elements and keep the current image preloading. Preserve follower hop trigger keyed by `movementAttempt`; position update itself must not replace the `img` element except when its facing source actually changes.
  4. Static rescue targets and exit use the expanded floor-center position from T01. The exit is rendered at its `MazeCell` center; follower coordinates may be any walkable expanded tile.
- **Tests**: inspect data attributes and inline grid translation for one connector move, follower at connector, target and exit at odd/odd centers, 1.4 tile sprite size, and a stable player image/root through movement and facing changes.

### I03. 출구 투명도 및 상호작용 회귀

- Related Files:
  - `src/components/Exit/ExitSprite.tsx` :: `ExitSprite` — 상태별 asset 표시; inspect, modify only if required
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.exitSprite`, `.exitUnlocked` — 투명 컨테이너 스타일; modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: board rendering and movement tests; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: keyboard/button movement integration; modify
  - `src/game/integration.test.tsx` :: rescue/exit route; modify
- **Execution Flow / Logic**:
  1. Remove the opaque `background`/`background-color` from `.exitSprite` and `.exitUnlocked`. Retain locked grayscale filter and unlocked shadow/glow; do not edit `public/assets/maps/exit.png`.
  2. Keep keyboard repeat timing and `movementAttempt` ownership in `GameScreen`; one callback dispatch still asks for one reducer step. Direction controls must use the same callback.
  3. Adapt integration movement helpers to walk each one-cell connector and center. Complete route must rescue all targets, enter exit center, and win.
- **Tests**: locked/unlocked exit has no opaque fill while visual effects remain; keyboard and direction control trigger exactly one adjacent expanded coordinate per callback; the full rescue/exit route completes; actor/board checks from I01/I02 pass.

## Acceptance Criteria
- [x] Player and follower each occupy and move to adjacent expanded render tiles, and camera tracks the player's tile directly.
- [x] Open connectors render as floor, closed wall connectors and even/even junctions remain blocked.
- [x] Targets/exit stay at logical floor centers; follower can render on an open connector.
- [x] Player and animal sprites remain 1.4 small tiles (70% of original floor tile) with stable, non-flashing image roots.
- [x] Exit image alpha is visible in both states; locked grayscale and unlocked glow remain.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx src/game/integration.test.tsx` — renderer and full movement route pass
- `npm.cmd run lint` — type and lint checks pass

## Commit Message
```text
feat(rendering): 보드 이동을 렌더 칸 단위로 표시

계획: 2026-09-30-one-render-cell-per-move
단계: P01-render-cell-movement
작업: T02-expanded-grid-rendering-and-transparent-exit

- 확장 좌표를 사용해 플레이어와 동물을 렌더링
- 구조 대상과 출구를 바닥 중심에 유지
- 출구 투명도와 기존 스프라이트 크기를 보존
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

