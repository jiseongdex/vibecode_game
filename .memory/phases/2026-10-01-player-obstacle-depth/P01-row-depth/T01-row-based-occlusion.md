# Task: T01 플레이어와 장애물의 행별 겹침

## Status: done

## Goal
현재 모든 장애물의 고정 `z-index: 7`과 플레이어의 고정 `z-index: 9` 때문에 아래쪽 장애물이 발을 가리지 못한다. 시각 격자 행에 따라 두 요소의 깊이를 계산해, 플레이어와 겹치는 위쪽 장애물은 뒤로, 아래쪽 장애물은 앞으로 그린다. 이전 요청에 따라 구출 동물과 탈출구는 모든 장애물보다 앞에 남겨 둔다.

## Decision Summary
- `.memory/decisions/2026-10-01-player-obstacle-depth.md`의 D01~D02: 화면의 아래쪽 장애물이 플레이어 발 일부를 가리고, 위쪽 장애물은 플레이어 뒤에 둔다. 같은 행이면 플레이어가 앞에 오고 이동 시 깊이를 갱신한다.
- D03~D04: 구출 동물과 탈출구를 장애물보다 앞에 유지한다. 플레이어 크기 1.6칸, 장애물 이미지의 185% 표시와 `overflow: visible`, 투명 배경, 이동·회전 애니메이션, 게임 좌표·충돌·카메라·저장 규칙은 그대로 둔다.

## Implementation

### I01. 깊이 계산을 한곳에 정의
- Related Files:
  - `src/components/MazeBoard/boardDepth.ts` :: `wallDepth`, `playerDepth`, `foregroundDepth`; new
  - `src/components/MazeBoard/boardGeometry.ts` :: `visualSize`, `visualCell`; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export function wallDepth(visualRow: number): number
  export function playerDepth(visualRow: number): number
  export function foregroundDepth(boardTiles: number): number
  ```
- **Data & Schema Fields**: 새로운 모델이나 영속 필드는 없다. `visualRow`는 `state.player.row` 및 `ObstacleTile.row`의 0부터 시작하는 시각 격자 행이고, `boardTiles`는 `visualSize(state.maze.size) = maze.size * 2 + 1`이다. 세 함수 모두 CSS `z-index`에 사용할 정수를 반환한다.
- **Execution Flow / Logic**:
  1. `wallDepth(row) = row * 2 + 1`, `playerDepth(row) = row * 2 + 2`, `foregroundDepth(boardTiles) = boardTiles * 2 + 3`으로 정의한다.
  2. 따라서 `wallDepth(row - 1) < wallDepth(row) < playerDepth(row) < wallDepth(row + 1)`이다. 같은 행의 벽보다 플레이어가 앞이고, 바로 아래 행의 벽보다 뒤다. 모든 유효 벽 행 `0..boardTiles - 1`은 `foregroundDepth(boardTiles)`보다 낮다.
  3. 행과 보드 크기는 기존 게임/렌더 상태에서 오므로 별도 상태, 예외 분기, 좌표 변환을 추가하지 않는다. 최대 기존 스테이지의 미로 크기 33에서도 동일한 부등식이 성립해야 한다.

### I02. 플레이어·장애물·전경에 깊이 적용
- Related Files:
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`, `WallLayer`; modify
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite`; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`, `boardStyle`; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.obstacleTile`, `.playerSprite`, `.rescueSprite`, `.followerSprite`, `.exitSprite`; modify
  - `src/components/MazeBoard/MazeCell.tsx` :: 탈출구의 부모 셀·중첩 확인; read-only
  - `src/components/Exit/ExitSprite.tsx` :: `.exitSprite` 적용 위치 확인; read-only
  - `src/components/Rescue/RescueSprite.tsx` :: 구출 동물·동행 동물 클래스 확인; read-only

#### Details
- **Signatures & Types**: 기존 React props와 DOM 구조는 유지한다. `MazeBoard.boardStyle`은 `CSSProperties` 캐스트를 유지하고 CSS 사용자 정의 속성 `--foreground-depth`를 추가한다. `ObstacleTile.style`과 `PlayerSprite`의 인라인 `style`에 각각 숫자 `zIndex`를 추가한다.
- **Data & Schema Fields**: `--foreground-depth: foregroundDepth(boardTiles)`만 보드 DOM 스타일에 추가한다. 기존 `--cell-size`, `--visual-size`, `position.row/col`, `gridRow/gridColumn`, `data-visual-row/col`은 변경하지 않는다.
- **Execution Flow / Logic**:
  1. `ObstacleTile`은 `wallDepth(row)`를 인라인 `zIndex`로 넣는다. `WallLayer`가 생성하는 닫힌 벽과 교차점 모두 같은 `ObstacleTile`을 쓰므로 빠지는 장애물이 없어야 한다.
  2. `PlayerSprite`는 `playerDepth(position.row)`를 인라인 `zIndex`로 넣는다. `position`은 이미 시각 격자 좌표이며 이동 시 렌더가 갱신된다. 이동 애니메이션의 `translate`, 이미지 크기, 방향 전환 오버레이는 건드리지 않는다.
  3. `MazeBoard`의 `boardTiles`로 `foregroundDepth(boardTiles)`를 계산하여 `boardStyle['--foreground-depth']`에 넣는다. 보드 크기가 달라져도 전경이 모든 장애물보다 앞선다.
  4. CSS `.obstacleTile`의 고정 `z-index: 7`, `.playerSprite`의 고정 `z-index: 9`를 제거한다. `.rescueSprite`, `.followerSprite`, `.exitSprite`의 `z-index: 8`은 `z-index: var(--foreground-depth)`로 바꾼다. 공통 `.sprite`의 기본 `z-index: 2`는 유지한다.
  5. `.cell`에는 새 stacking context를 만들지 않는다. 탈출구는 `MazeCell` 자식이므로 부모에 `z-index`, `opacity`, `transform` 등을 추가하면 `exitSprite`가 높은 `z-index`를 받아도 장애물 뒤에 갇힐 수 있다. `.wallBlock`의 185% 크기, 투명 PNG, `.obstacleTile { overflow: visible; }`, 뷰포트의 `overflow: hidden`을 유지한다.
  6. 게임 로직, 벽 생성 좌표·변형, 구출 동물 위치, 카메라 계산에는 수정이 필요 없다. 레이어 깊이만 바꾼다.

## Acceptance Criteria
- [x] 플레이어 바로 위 행의 장애물은 플레이어 뒤에, 같은 행은 플레이어 뒤에, 바로 아래 행은 플레이어 발 앞에 그려진다.
- [x] 플레이어가 이동해 시각 격자 행이 바뀌면 겹침 순서도 즉시 바뀐다. 왼쪽·오른쪽으로 이동할 때도 현재 행 기준을 유지한다.
- [x] 닫힌 벽과 교차점 모두 행별 깊이를 받는다. 벽의 큰 이미지, 투명 배경, 그림 연결 상태가 유지된다.
- [x] 구출 대상·동행 동물·탈출구가 모든 장애물보다 앞에 보인다. 탈출구는 한 칸에 머문다.
- [x] 플레이어의 1.6칸 크기, 부드러운 이동과 방향 전환, 충돌·카메라·저장 동작이 유지된다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 기존 보드 렌더·벽 위치·이동·동물·탈출구 동작 확인. 새 테스트 파일은 추가하지 않는다.
- `npm.cmd run build` — TypeScript와 Vite 빌드 확인.
- 실행 화면에서 플레이어를 위·아래·코너로 이동시켜 벽이 발을 가리는 순서와 동물·탈출구 가시성을 확인한다. DOM 순서만으로 판단하지 말고 실제 화면의 겹침을 확인한다.

## Commit Message
```text
fix(maze): 플레이어와 장애물의 앞뒤 겹침을 행별로 조정

Plan: 2026-10-01-player-obstacle-depth
Phase: P01-row-depth
Task: T01-row-based-occlusion

- 시각 격자 행으로 장애물과 플레이어 깊이 계산
- 구출 동물과 탈출구의 장애물 위 표시 유지
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (보드 테스트 19개, 빌드, 실행 화면 확인)
- commit: Git 기록 참조
