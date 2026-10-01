# Task: T01 플레이어 확대와 장애물 잘림 해소

## Status: done

## Goal
플레이어 이미지 상자를 조금 키워도 시각 격자 중심에 놓이게 하고, 확대된 장애물 PNG가 타일 경계에서 잘리지 않게 한다.

## Decision Summary
- `.memory/decisions/2026-10-01-player-size-wall-clipping.md`의 D01~D03을 따른다. 플레이어는 `1.4`에서 `1.6` 시각 칸으로 키우고 구출 동물은 `1.4`칸을 유지한다.
- 장애물은 타일 내부 `overflow: hidden`만 해제한다. `.wallBlock`의 `185%` 이미지 크기와 바깥 `.viewport`의 화면 경계 클리핑은 유지한다.

## Implementation

### I01. 플레이어 크기와 중앙 좌표 변경
- Related Files:
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite` — 표시 상자와 픽셀 좌표; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.sprite`, `.playerSprite` — CSS 변수 사용 확인; read-only for this unit
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite` — 구출 동물 `1.4`칸 유지 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  const PLAYER_SPRITE_SCALE = 1.6
  const spriteInset = (PLAYER_SPRITE_SCALE - 1) / 2
  const spriteLeft = Math.round((position.col - spriteInset) * cellSize * 100) / 100
  const spriteTop = Math.round((position.row - spriteInset) * cellSize * 100) / 100
  // PlayerSpriteProps와 함수 시그니처는 변경하지 않음
  ```
- **Data & Schema Fields**: `position: Position`, `cellSize: number`는 기존 props이다. 새 게임 상태·저장 필드 없음. CSS 변수 `--sprite-size` 값은 `calc(var(--cell-size) * 1.6)`이다.
- **Execution Flow / Logic**:
  1. `PlayerSprite`의 기존 `position.col/row - 0.2`를 `spriteInset` 계산으로 교체한다. 스프라이트 상자 가운데가 시각 격자 칸 중심 `position + 0.5`에 계속 오도록 한다.
  2. 플레이어 root `<span>`의 inline `--sprite-size`만 `calc(var(--cell-size) * 1.6)`으로 바꾼다. `.playerSprite`가 이미 해당 변수를 폭·높이에 사용한다. 방향 이미지, 이동 `translate` 120ms, 회전 overlay, `data-grid-row/col`과 접근성 이름은 유지한다.
  3. `RescueSprite`의 `--sprite-size: calc(var(--cell-size) * 1.4)`와 위치 계산은 그대로 둔다.

### I02. 장애물 타일 안쪽 잘림 제거
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.obstacleTile`, `.wallBlock`, `.viewport` — 벽 이미지 표시; modify
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`, `WallLayer` — 격자 위치와 이미지 구조 확인; read-only

#### Details
- **Signatures & Types**: CSS `.obstacleTile`의 `overflow: hidden`을 `overflow: visible`로 바꾼다. React props와 벽 variant 타입은 변경하지 않는다.
- **Data & Schema Fields**: 새 필드 없음. `data-wall-side`, `data-junction`, `data-visual-row/col`은 유지한다.
- **Execution Flow / Logic**:
  1. `.obstacleTile`의 한 칸 크기와 `z-index: 7`을 유지하면서 `overflow`만 보이도록 한다. 기존 `.wallBlock`의 `width/height: 185%`, 중앙 정렬, 투명 PNG, 오류 fallback은 유지한다.
  2. `.viewport`의 `overflow: hidden`은 유지해 카메라 창 바깥 맵이 보이지 않게 한다. 플레이어 `z-index: 9`와 구출 동물 `z-index: 8`이 벽 `z-index: 7` 위에 보이는 순서도 유지한다.
  3. 벽 점유·충돌 정보나 타일 배경색을 변경하지 않는다.

### I03. 크기·위치 회귀 검증
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `renders open connectors…`, 스프라이트 크기 검사, 플레이어 이동 검사, 장애물 검사 — modify

#### Details
- **Signatures & Types**: 기존 `render(<MazeBoard … />)`와 `--cell-size`, `data-asset-slot` 검사 패턴 사용. 테스트용 게임 모델 변경 없음.
- **Data & Schema Fields**: 플레이어 크기 CSS 변수는 `calc(var(--cell-size) * 1.6)`, 구출 대상·동료는 `calc(var(--cell-size) * 1.4)`로 검사한다.
- **Execution Flow / Logic**:
  1. 플레이어 초기 및 이동 후 `style.translate` 기대값의 `position - 0.2`를 `position - 0.3`으로 바꾼다. `cellSize`는 보드 `--cell-size`에서 읽는다.
  2. 기존 ‘플레이어와 구출 동물 크기가 같다’ 검사를 ‘플레이어만 더 크다’로 바꾸고 `--sprite-size` 값과 이미지 `objectFit: contain`을 확인한다.
  3. 장애물 이미지의 parent가 `.obstacleTile`이며 `.wallBlock` 크기가 변경되지 않았음을 검사한다. CSS overflow는 JSDOM에서 레이아웃되지 않으므로 CSS 선언 검토 또는 실제 브라우저에서 별도 확인한다. 기존 장애물 개수·variant·투명 배경 검사를 삭제하지 않는다.

## Acceptance Criteria
- [x] 플레이어 상자는 `1.6` 시각 칸이며 확대 전과 같은 격자 중심에 놓인다.
- [x] 구출 동물 크기·위치는 그대로다.
- [x] 장애물 PNG의 실루엣이 개별 타일 경계에서 잘리지 않고 투명 배경과 표시 순서가 유지된다.
- [x] 화면 경계 바깥 맵은 가려지고 게임 규칙·저장 형식은 바뀌지 않는다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 플레이어·동물 위치, 장애물 구조, 기존 보드 검사 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 탐험가를 키우고 장애물 잘림 해소

Plan: 2026-10-01-player-size-wall-clipping
Phase: P01-visual-alignment
Task: T01-adjust-player-and-wall-visuals

- 탐험가 크기를 키우고 격자 중심 보정
- 장애물 이미지의 타일 내부 클리핑 제거
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
