# Task: T03 화면 틀과 시야 추가 확대

## Status: done

## Goal
현재 게임 화면에서 미로 틀을 조금 더 크게 표시하고, 같은 화면 안의 타일·캐릭터를 추가 확대한다.

## Decision Summary
- `.memory/decisions/2026-10-01-zoomed-maze-viewport.md`의 최신 D07을 따른다. D07의 수치가 이전 화면 틀·시야 수치보다 우선한다.
- 카메라 추적, 스프라이트 계층, 이동·충돌 및 저장 형식은 변경하지 않는다.

## Implementation

### I01. 게임 화면과 미로 틀 확대
- Related Files:
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen` — 게임 화면 최대 너비; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport`, 두 반응형 미디어 쿼리 — 미로 틀 높이; modify

#### Details
- **Signatures & Types**: CSS 선택자만 수정하며 React props 변경 없음.
- **Data & Schema Fields**: 새 필드 없음.
- **Execution Flow / Logic**:
  1. `.screen`의 `width: min(100%, 1120px)`를 `width: min(100%, 1240px)`로 바꾼다. 기존 `box-sizing: border-box`, padding, 가운데 정렬은 유지한다.
  2. 기본 `.viewport`의 `width: 100%`는 유지하고 `height: min(80vh, 760px)`를 `height: min(88vh, 840px)`로 바꾼다. 테두리·overflow·스프라이트 계층은 유지한다.
  3. `@media (max-width: 600px)`의 높이는 `min(60vh, 540px)`에서 `min(65vh, 590px)`로 바꾼다. 얇은 테두리를 유지한다.
  4. 마지막 낮은 가로 화면 쿼리의 높이는 `min(52vh, 360px)`에서 `min(58vh, 400px)`로 바꾼다. 모바일과 겹치면 이 규칙이 우선한다.

### I02. 시각 격자 칸과 스프라이트 추가 확대
- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `TARGET_VISIBLE_COLUMNS`, `TARGET_VISIBLE_ROWS`, `MazeBoard` — 칸 크기 계산; modify
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite` — 확대된 `cellSize` 사용 확인; read-only
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite` — 확대된 `cellSize` 사용 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  const TARGET_VISIBLE_COLUMNS = 7.8
  const TARGET_VISIBLE_ROWS = 6.0
  const cellSize: number = Math.max(
    1,
    Math.floor(Math.min(
      viewport.width / TARGET_VISIBLE_COLUMNS,
      viewport.height / TARGET_VISIBLE_ROWS,
    )),
  )
  ```
- **Data & Schema Fields**: 새 필드 없음. `viewport.width/height`는 기존 DOM 측정값(px), `cellSize`는 양의 정수(px)이다.
- **Execution Flow / Logic**:
  1. 두 목표 상수만 기존 `8.5`·`6.5`에서 `7.8`·`6.0`으로 바꾼다. `Math.min` 계산, `--cell-size` 전달, `cameraOffset` 본문은 그대로 둔다.
  2. 같은 크기의 뷰포트에서 칸이 커져 보이는 범위가 약 8×6칸이 된다. 실제 CSS 화면 비율이 다르면 보이는 칸 수는 달라질 수 있다.
  3. 확대된 칸 크기를 `PlayerSprite`·`RescueSprite`에 기존 방식대로 전달하고 좌표 및 애니메이션 시간을 바꾸지 않는다.

### I03. 카메라 및 스프라이트 검사 갱신
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 카메라 경계·좁은 화면·스프라이트 위치 테스트 — 회귀 검사; modify

#### Details
- **Signatures & Types**: 기존 `render(<MazeBoard … />)` 테스트 패턴 유지.
- **Data & Schema Fields**: 새 fixture 필드 없음.
- **Execution Flow / Logic**:
  1. JSDOM 초기 측정 fallback `640×480`에서 `cellSize=80px`, 보이는 칸 수가 `8×6`인지 확인한다. 시작 가장자리 카메라 변환은 `translate3d(0px, 0px, 0)`이다.
  2. 시각 좌표 `(12,12)`에서 `translate3d(-680px, -760px, 0)`, `(13,13)`에서 `translate3d(-760px, -840px, 0)`, 반대쪽 `(29,29)`에서 `translate3d(-1840px, -2000px, 0)`인지 검사한다. 마지막 값은 `31×80=2480px` 보드의 바깥을 노출하지 않는 clamp 결과다.
  3. 기존 좁은 화면 측정 fixture `320×245`에서는 `cellSize=40px`, 보이는 칸 수가 `8×6.125`인지 확인한다. `getBoundingClientRect` mock은 `finally`에서 복구한다.
  4. 플레이어·구출 동물 위치 검사는 이미 `--cell-size`를 읽어 계산하므로 유지한다. 기존 장애물·통로·애니메이션·계층 테스트를 삭제하거나 완화하지 않는다.

## Acceptance Criteria
- [x] 게임 화면 최대 너비가 1240px이고 미로 틀은 가용 너비를 채운다.
- [x] 미로 틀 높이가 기본 `min(88vh, 840px)`, 모바일 `min(65vh, 590px)`, 낮은 가로 화면 `min(58vh, 400px)`이다.
- [x] 같은 뷰포트에서 이전 T02보다 타일·캐릭터가 크고 보이는 칸 수가 줄어든다.
- [x] 플레이어 추적, 맵 가장자리 제한, 스프라이트 위치와 게임 규칙이 유지된다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 확대 시야 및 기존 보드 회귀 검사 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 미로 화면 틀과 탐험 시야를 추가 확대

Plan: 2026-10-01-zoomed-maze-viewport
Phase: P01-viewport-zoom
Task: T03-increase-frame-and-zoom

- 게임 화면과 미로 틀 크기를 한 단계 확대
- 그림 칸 크기 및 카메라 회귀 검사 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
