# Task: T01 타일을 줄여 내부 미로 시야 확대

## Status: done

## Goal

맵틀의 반응형 외형을 유지하면서 내부 타일 기준을 `108px`로 낮춰 어떤 창에서도 약 `11.48×7.78`칸을 보이게 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-slightly-wider-maze-view.md): 사용자가 약 `11.5×7.8`칸, 타일 약 10% 축소를 선택했다.
- [직전 노트북 배율](../../../decisions/2026-10-02-laptop-fit-fixed-maze-view.md)의 너비·높이 맞춤과 `1440×900px` 무스크롤 기준을 유지한다.

## Implementation

### I01. 내부 타일 기준과 카메라 픽셀 좌표

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT`, `TARGET_VISIBLE_COLUMNS`, `TARGET_VISIBLE_ROWS`, `CELL_SIZE`, `cameraOffset` — modify only target values
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 중앙 추적, 양 끝 경계, scale 테스트 — modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `--cell-size` 소비와 플레이어 크기 — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  const VIEWPORT_WIDTH = 1240
  const VIEWPORT_HEIGHT = 840
  const TARGET_VISIBLE_COLUMNS = 11.4
  const TARGET_VISIBLE_ROWS = 7.7
  const CELL_SIZE = Math.floor(Math.min(
    VIEWPORT_WIDTH / TARGET_VISIBLE_COLUMNS,
    VIEWPORT_HEIGHT / TARGET_VISIBLE_ROWS,
  )) // 108; actual visible cells: 1240/108≈11.48, 840/108≈7.78
  // MazeBoardProps.scale?: number 및 cameraOffset(...) 시그니처는 그대로 유지
  ```
- **Data & Schema Fields**: 새 모델 필드 없음. `GameState.player.row/col`, `maze`, rescue/follower 좌표와 저장 데이터의 타입·값은 변경하지 않는다. `sceneScale`과 `--cell-size`는 표시 전용이다.
- **Execution Flow / Logic**:
  1. viewport 기준 크기와 `cameraOffset(visualCoordinate, boardTiles, cellSize, viewportSize)` 공식은 그대로 두고 새 `CELL_SIZE`를 넣는다. 타일, 플레이어, 장애물, 동물, 카메라 이동량에 공통 `cellSize = CELL_SIZE * sceneScale`을 사용한다.
  2. 15×15 미로의 `boardTiles=31`에서 player `(12,12)` 카메라 `(-730,-930)`, `(13,13)`에서 `(-838,-1038)`, `(29,29)` 끝에서 `(-2108,-2508)`이다. 시작 `(1,1)`은 `(0,0)`이다. scale `0.5`의 중앙 `(-365,-465)`, 끝 `(-1054,-1254)`, cell `54px`; scale `1.28`의 중앙 `(-934.4,-1190.4)`, cell `138.24px`이다.
  3. viewport 대비 보이는 타일 수 `1240/108`, `840/108`이 창 크기와 무관하게 일정해야 한다. 플레이어 `--sprite-size: calc(var(--cell-size) * 1.6)` 비율을 유지한다.
- **Error & Exception Handling**: `CELL_SIZE`의 정수 반올림 결과가 정확히 108인지 확인한다. 숫자만 바꾸면서 카메라가 맵 밖으로 벗어나거나 가장자리 floor가 비지 않게 경계 회귀 테스트를 갱신한다.

### I02. 창 배율·기능 회귀

- Related Files:
  - `src/components/GameScreen/GameScreen.test.tsx` :: 첫 배율·resize 테스트의 tile 기대값 — modify
  - `src/components/GameScreen/GameScreen.tsx` :: 맵틀의 너비·높이 배율 — read-only
  - `src/components/Player/PlayerSprite.tsx` :: 플레이어 크기·좌표 소비 — read-only

#### Details

- **Signatures & Types**: `GameScreen`의 `BASE_FRAME_WIDTH=1250`, `BASE_FRAME_HEIGHT=850`, `sceneScale:number`은 그대로. 타일 기준만 `108 * sceneScale`로 바뀐다.
- **Data & Schema Fields**: 게임 상태·저장 스키마 변경 없음.
- **Execution Flow / Logic**:
  1. 기존 GameScreen 테스트의 `1440×900` 높이 제한 배율 `756/850`에서 cell은 `108*756/850≈96.06px`; area width625의 scale0.5에서 `54px`; 높이 제한 `956/850`에서 `108*956/850≈121.47px`으로 갱신한다. frame `1111.76×756`, `625×425`, 높이956은 바꾸지 않는다.
  2. 기존 `120px`, `60px`, `153.6px`, 이전 카메라 좌표를 `src`에서 검색해 이 기능 관련 기대값만 갱신한다. 미로 위치와 키보드 이동 테스트는 그대로 통과해야 한다.
  3. 실제 브라우저에서 `1440×900`, `1366×768`, `390×844`의 frame 크기/스크롤과 viewport/content tile 비율을 확인한다. 제목·모바일 버튼·일시정지 팝업은 기존 회귀 테스트로 확인한다.
- **Error & Exception Handling**: 화면 배율을 다시 바꾸거나 UI 공간을 수정하지 않는다. 0.5/1.28에서 소수점 픽셀은 `toBeCloseTo`로 비교한다.

## Acceptance Criteria

- [x] 보이는 시야가 모든 창에서 가로 약 `11.48`칸·세로 약 `7.78`칸이다.
- [x] 맵틀 외형과 `1440×900px` 무스크롤 레이아웃이 유지된다.
- [x] 플레이어/타일·장애물/타일 상대 비율과 카메라 시작·중앙·끝 경계가 유지된다.
- [x] 이동·충돌·구출·저장, 캠페인·모바일 버튼·팝업의 기존 테스트가 통과한다.
- [x] 전체 테스트, lint, build, 실제 브라우저 확인이 통과한다.

## Validation

- `npm.cmd test -- --run --maxWorkers=2` — 전체 Vitest 회귀 테스트.
- `npm.cmd run lint` — TypeScript 검사.
- `npm.cmd run build` — 프로덕션 빌드.
- `npm.cmd run dev -- --host 127.0.0.1` — Chrome에서 노트북·작은 노트북·모바일 시야·스크롤 확인.

## Commit Message

```text
feat(maze): 내부 시야를 약 11.5×7.8칸으로 확대

Plan: 2026-10-02-slightly-wider-maze-view
Phase: P01-maze-zoom
Task: T01-reduce-tile-size

- 타일 기준 크기를 108px로 줄여 맵 칸 수 확대
- 카메라와 반응형 배율 회귀값 갱신
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 전체 테스트 107개, lint, build, Chrome 1440×900·1366×768·390×844에서 고정 시야와 스크롤 확인
- commit: 이 Task의 구현 커밋 (`git log` 참조)

- `.memory/`는 `.gitignore` 대상이므로 이 Task 파일은 `git add -f`로 명시적으로 스테이징한다.
