# Task: T01 가로형 장애물 그림 크기 조정

## Status: done

## Goal

사탕·얼음·사막 테마의 가로로 긴 장애물만 기존 `185%`에서 `135%`로 줄여 옆 장애물 위에 과하게 그려지는 문제를 완화한다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-wide-obstacle-sizing.md): 사탕 `wall-02`, 얼음·사막 `wall-03`만 축소한다. 숲과 나머지 이미지는 그대로다.
- 현재 `ObstacleTile`은 테마와 variant별 `src`를 선택하지만, `.wallBlock`은 모든 에셋에 `width/height:185%`를 적용한다. 폭이 넓은 PNG 그림이 옆 타일을 덮는 원인이다.

## Implementation

### I01. 에셋별 표시 크기 데이터

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
    floorColor: string
    wallColor: string
  }
  function themeAssets(
    theme: MazeThemeId,
    floorColor: string,
    wallColor: string,
    wallDisplaySize: readonly [number, number, number] = [185, 185, 185],
  ): MazeThemeAssets
  ```
- **Data & Schema Fields**: `wallDisplaySize`는 **표시 전용** 0/1/2 variant별 퍼센트 배열이다. 기본 `[185,185,185]`, `candy:[185,135,185]`, `ice:[185,185,135]`, `desert:[185,185,135]`. `Maze`, `GameState`, 저장 스키마의 필드 변경 없음.
- **Execution Flow / Logic**:
  1. `themeAssets`가 `wallDisplaySize`를 에셋 목록과 함께 반환한다. 4개 테마의 기존 floor/wall 경로·색상을 유지하고 사탕/얼음/사막에만 사용자 지정 배열을 전달한다. 숲은 기본값을 쓴다.
  2. 각 벽 슬롯은 기존 `getWallVariant` 결과 0/1/2로 이미지와 크기 배열의 같은 인덱스를 읽는다. 파일명 문자열 검사나 자산별 조건문을 렌더 컴포넌트에 두지 않는다.
- **Error & Exception Handling**: 3개 variant 튜플 길이를 타입으로 고정해 누락을 방지한다. 크기 값은 정적인 양의 숫자로 선언한다.

### I02. CSS 변수로 이미지만 축소

- Related Files:
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`, `WallLayer` — modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.wallBlock`, `.obstacleTile` — modify
  - `src/components/MazeBoard/boardDepth.ts`, `boardGeometry.ts` — read-only

#### Details

- **Signatures & Types**:
  ```tsx
  const style = {
    gridRow: row + 1,
    gridColumn: col + 1,
    zIndex: wallDepth(row),
    '--wall-color': theme.wallColor,
    '--wall-image-size': `${theme.wallDisplaySize[variant]}%`,
  } as CSSProperties
  ```
  ```css
  .wallBlock {
    width: var(--wall-image-size, 185%);
    height: var(--wall-image-size, 185%);
  }
  ```
- **Data & Schema Fields**: CSS 사용자 정의 속성 `--wall-image-size`를 각 `.obstacleTile`에 설정하고 자식 이미지가 상속받는다. DOM의 `data-wall-variant`, `data-wall-side`, `data-junction`, 위치·z-index는 그대로다.
- **Execution Flow / Logic**:
  1. 기존 그림 중심 위치 `top/left:50%`, `translate(-50%,-50%)`, `object-fit:contain`을 유지하며 폭·높이에 같은 값을 사용해 원본 비율을 보존한다.
  2. 축소는 이미지 박스에만 적용한다. 벽 슬롯의 한 타일 크기·hit geometry·fallback 크기·깊이 순서는 변경하지 않는다.
- **Error & Exception Handling**: 이미지 로드 오류 시 `hidden`과 fallback 표시를 그대로 사용한다. 이미지가 이웃 벽 뒤로 가는 현상과 구분하여 z-index를 변경하지 않는다.

### I03. 회귀와 시각 검증

- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 기존 obstacle variant·깊이·fallback 테스트 — read-only
  - `src/assets/mazeTheme.test.ts` :: 테마 고정 선택 테스트 — read-only

#### Details

- **Signatures & Types**: 새 저장 데이터나 API 없음. 기존 테스트는 정적 CSS 값을 되풀이하는 신규 테스트로 늘리지 않는다.
- **Data & Schema Fields**: 기존 게임 데이터 구조 그대로.
- **Execution Flow / Logic**:
  1. 전체 Vitest/lint/build로 렌더·타입 회귀를 확인한다. 실제 브라우저에서 사막 테마 또는 세 에셋을 함께 보는 검증 화면을 열어 135% 적용, 이웃 장애물과의 겹침 감소, 이미지 비율·중심 배치를 확인한다.
  2. 숲과 축소 대상 아닌 variant는 185%로 남았는지 DOM의 `--wall-image-size` 또는 computed style로 확인한다. 화면 배율이 달라도 타일 기준 상대 크기가 같아야 한다.
- **Error & Exception Handling**: 시각적으로 너무 작아져 벽이 끊겨 보이면 같은 세 variant의 퍼센트만 조정하고 다시 확인한다. 게임 좌표나 이미지 파일을 수정하지 않는다.

## Acceptance Criteria

- [x] 사탕 wall-02, 얼음·사막 wall-03만 135%로 표시되고 나머지 장애물은 185%다.
- [x] 가로형 장애물의 이미지 비율·중심 배치가 유지되고 옆 장애물을 과하게 덮지 않는다.
- [x] 장애물 슬롯, 충돌, z-index, fallback, 고정 시야와 저장 동작은 그대로다.
- [x] 전체 테스트, lint, build 및 브라우저 시각 검증이 통과한다.

## Validation

- `npm.cmd test -- --run --maxWorkers=2` — 전체 Vitest 회귀 테스트.
- `npm.cmd run lint` — 타입 검사.
- `npm.cmd run build` — 프로덕션 빌드.
- `npm.cmd run dev -- --host 127.0.0.1` — Chrome에서 장애물 크기·겹침·테마별 적용 확인.

## Commit Message

```text
fix(maze): 가로형 장애물 이미지 겹침 완화

Plan: 2026-10-02-wide-obstacle-sizing
Phase: P01-wall-art-sizing
Task: T01-size-wide-wall-art

- 사탕·얼음·사막 가로형 장애물만 표시 크기 조정
- 테마별 에셋 크기 설정과 시각 회귀 확인
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 전체 테스트 107개, lint, build, Chrome에서 사탕·얼음·사막의 185%/135% 비교 및 숲 185% 확인
- commit: 이 Task의 구현 커밋 (`git log` 참조)

- `.memory/`는 `.gitignore` 대상이므로 완료 시 이 Task 파일을 `git add -f`로 명시적으로 스테이징한다.
