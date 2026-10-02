# Task: T01 세로 벽의 가로형 장애물 회전

## Status: done

## Goal

사탕 02·얼음 03·사막 03 장애물 이미지를 세로 벽에 배치할 때만 중심 기준 시계 방향 90도 회전해 그림의 방향이 벽 배열과 맞게 한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-vertical-wide-obstacles.md): `left/right` 벽 슬롯만 회전하며 `up/down`과 `side` 없는 연결점은 원래 방향을 유지한다.
- 직전 [크기 결정](../../../decisions/2026-10-02-wide-obstacle-sizing.md)의 대상 에셋과 `135%` 크기를 유지한다. 벽 슬롯·충돌·깊이 계산을 변경하지 않는다.

## Implementation

### I01. 테마별 회전 메타데이터

- Related Files:
  - `src/assets/assetManifest.ts` :: `MazeThemeAssets`, `themeAssets`, `mazeThemes` — modify
  - `public/assets/maps/maze-candy-wall-02.png`, `maze-ice-wall-03.png`, `maze-desert-wall-03.png` — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export interface MazeThemeAssets {
    floor: readonly [string, string]
    wall: readonly [string, string, string]
    wallDisplaySize: readonly [number, number, number]
    wallRotateOnVertical: readonly [boolean, boolean, boolean]
    floorColor: string
    wallColor: string
  }
  function themeAssets(
    theme: MazeThemeId,
    floorColor: string,
    wallColor: string,
    wallDisplaySize: readonly [number, number, number] = [185, 185, 185],
    wallRotateOnVertical: readonly [boolean, boolean, boolean] = [false, false, false],
  ): MazeThemeAssets
  ```
- **Data & Schema Fields**: 새 `wallRotateOnVertical`은 **표시 전용** variant0/1/2 튜플이다. `forest:[false,false,false]`, `candy:[false,true,false]`, `ice/desert:[false,false,true]`. 기존 `wallDisplaySize`와 URL·색상은 그대로다. 게임 모델·저장 스키마에는 필드를 추가하지 않는다.
- **Execution Flow / Logic**:
  1. `themeAssets`가 회전 튜플을 반환하고 `mazeThemes`의 사탕·얼음·사막에만 지정한다. variant 인덱스는 기존 `theme.wall[variant]` 및 `wallDisplaySize[variant]`와 일치한다.
  2. 숲과 지정하지 않은 variant는 기본 `false`를 쓴다. 이미지 경로 문자열을 렌더 중 검사하지 않는다.
- **Error & Exception Handling**: 3개 원소를 타입으로 고정해 누락을 방지한다. boolean 값만 설정해 임의 각도 오류를 피한다.

### I02. 벽 방향과 이미지 회전 결합

- Related Files:
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`, `WallLayer` — modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.wallBlock` transform — modify
  - `src/components/MazeBoard/boardGeometry.ts` :: `visualWall`, `closedWallSlots` — read-only
  - `src/components/MazeBoard/boardDepth.ts` :: `wallDepth` — read-only

#### Details

- **Signatures & Types**:
  ```typescript
  const rotate = (side === 'left' || side === 'right') && theme.wallRotateOnVertical[variant]
  const style = {
    gridRow: row + 1,
    gridColumn: col + 1,
    zIndex: wallDepth(row),
    '--wall-color': theme.wallColor,
    '--wall-image-size': `${theme.wallDisplaySize[variant]}%`,
    '--wall-image-rotation': rotate ? '90deg' : '0deg',
  } as CSSProperties
  ```
  ```css
  .wallBlock {
    transform: translate(-50%, -50%) rotate(var(--wall-image-rotation, 0deg));
  }
  ```
- **Data & Schema Fields**: `--wall-image-rotation` CSS 변수는 각 `.obstacleTile`에만 적용되고 자식 `img`가 사용한다. 기존 `data-wall-side`, `data-junction`, `data-wall-variant`와 그리드 row/col/z-index를 유지한다.
- **Execution Flow / Logic**:
  1. `closedWallSlots`가 주는 `side:'left'|'right'`에서만 선택된 variant의 `rotate`를 true로 한다. `up/down` 및 junction의 `side===undefined`는 0도다.
  2. 이미지의 기존 `top/left:50%`, `translate(-50%,-50%)`, 동일 가로·세로 크기 `135%`, `object-fit:contain`을 유지한 채 시계 방향 90도 회전한다. PNG 자체, fallback, 타일 크기와 충돌 영역은 그대로다.
- **Error & Exception Handling**: 회전으로 이미지가 그리드 좌표를 바꾸지 않게 CSS transform만 적용한다. `hidden` 이미지와 fallback은 회전하지 않는다.

### I03. 방향별 검증

- Related Files:
  - `src/components/MazeBoard/MazeWall.test.tsx` :: 테마·variant·side 조합 — new
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 기존 슬롯·충돌·fallback 회귀 — read-only

#### Details

- **Signatures & Types**: `render(<WallLayer maze={generateMaze(15, createSeededRandom(123))} theme={mazeThemes[themeId]} />)`로 사탕 variant1, 얼음·사막 variant2를 각각 검증한다. `data-wall-side`, `data-wall-variant`, `data-junction` 셀렉터로 슬롯을 선택한다.
- **Data & Schema Fields**: 테스트 전용 fixture 외 모델 변경 없음.
- **Execution Flow / Logic**:
  1. 대상 variant의 `left/right` 벽 슬롯은 `--wall-image-rotation:90deg`, `up/down` 벽 슬롯과 junction은 `0deg`인지 확인한다. 같은 테마의 다른 variant와 숲의 모든 슬롯은 `0deg`다. 대상의 `--wall-image-size:135%`도 유지한다.
  2. 전체 Vitest/lint/build를 실행한다. 실제 브라우저에서 세 대상 이미지를 가로·세로 배열로 렌더해 회전, 중심 정렬, 크기와 이웃 장애물의 겹침을 확인한다.
- **Error & Exception Handling**: 무작위 미로 때문에 대상 슬롯이 없다는 거짓 통과가 생기지 않도록 각 선택 집합의 길이가 양수인지 먼저 검사한다. CSS transform은 브라우저 화면에서 확인한다.

## Acceptance Criteria

- [x] 사탕 02·얼음 03·사막 03이 세로 벽에서만 90도 회전한다.
- [x] 같은 이미지의 가로 벽과 연결점, 숲과 다른 장애물은 회전하지 않는다.
- [x] 기존 135% 크기·중심 정렬·이미지 비율, 벽 위치·충돌·깊이·fallback이 유지된다.
- [x] 전체 테스트, lint, build 및 실제 브라우저 시각 확인이 통과한다.

## Validation

- `npm.cmd test -- --run --maxWorkers=2` — 전체 Vitest 회귀 테스트.
- `npm.cmd run lint` — TypeScript 검사.
- `npm.cmd run build` — 프로덕션 빌드.
- `npm.cmd run dev -- --host 127.0.0.1` — Chrome에서 세 테마의 가로·세로 장애물과 연결점 확인.

## Commit Message

```text
feat(maze): 세로 벽의 가로형 장애물 회전

Plan: 2026-10-02-vertical-wide-obstacles
Phase: P01-wall-orientation
Task: T01-rotate-wide-walls

- 사탕·얼음·사막의 가로형 장애물에 세로 벽 회전 설정 추가
- 좌우 벽에서만 90도 회전하고 연결점은 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 전체 테스트 111개, lint, build, Chrome에서 사탕·얼음·사막의 가로 0도/세로 90도 비교
- commit: 이 Task의 구현 커밋 (`git log` 참조)

- `.memory/`는 `.gitignore` 대상이므로 완료 시 이 Task 파일을 `git add -f`로 스테이징한다.
