# Task: T01 철장과 탈출구 별빛 자산

## Status: done

## Goal

기존 동물·문 이미지를 유지한 채 미구출 동물에만 투명 철장을 겹친다. 탈출구 문은 플레이어와 같은 크기·행 깊이로 장애물 사이에 놓고, 모든 동물을 구출한 뒤에만 밝은 별빛을 겹친다.

## Decision Summary

- 철장과 별빛은 재사용 가능한 별도 투명 PNG 자산이다. 철장은 다섯 동물에 공통으로 사용하며, 동물 얼굴을 알아볼 수 있어야 한다.
- 잠긴 문은 현재 회색 표시를 유지한다. 열린 문은 기존 이미지를 그대로 쓰고 별빛과 은은한 움직임으로 강조한다. 모션 감소 설정에서는 움직임만 멈춘다.
- 문은 플레이어처럼 `1.6 × cellSize`이며 탈출구 셀 바닥에 맞춰 배치한다. 현재의 최상위 `--foreground-depth` 대신 `playerDepth(exit.row)`를 사용해 앞쪽 장애물이 문을 가리게 한다.

## Implementation

### I01. 투명 자산 두 개 생성·검사

- Related Files:
  - `public/assets/animals/rescue-cage-overlay.png` :: 구출 전 동물의 공통 철장; new
  - `public/assets/maps/exit-sparkles.png` :: 열린 탈출구에 겹치는 금빛 별빛; new
  - `public/assets/animals/rescue-rabbit-front.png` :: 기존 동물 아트 스타일 참고; read-only
  - `public/assets/maps/exit.png` :: 기존 문 이미지 스타일 참고·유지; read-only

#### Details

- **Signatures & Types**: 두 파일은 알파 채널이 있는 PNG 비트맵이다. 기존 동물과 문 원본 파일명·픽셀은 바꾸지 않는다.
- **Data & Schema Fields**: 새 런타임 상태 필드는 없다. 자산 경로는 `/assets/animals/rescue-cage-overlay.png`, `/assets/maps/exit-sparkles.png`다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 프로젝트의 기존 토끼·탈출구 이미지를 `view_image`로 확인한다. 두 자산은 `imagegen` 스킬의 기본 내장 도구를 각각 한 번씩 호출하고 `transparent_background: true`로 생성한다. CLI/API 모드로 전환하지 않는다.
  2. Cage Prompt: Use case `stylized-concept`; 어린이용 동화풍 3D 게임 스프라이트 오버레이. 전면에서 본 둥근 금속 철장 테두리와 성긴 수직 창살, 부드러운 어두운 금속·따뜻한 하이라이트. 정사각형 프레임 안 중앙에 충분한 투명 구멍을 남겨 뒤의 동물 눈·얼굴이 보이게 한다. **동물, 배경, 바닥, 글자, 그림자판, 워터마크 없음**. 외부와 창살 사이가 실제 투명 알파인 독립 PNG.
  3. Sparkle Prompt: Use case `stylized-concept`; 기존 황금빛 숲 문 위에 얹는 별빛 오버레이. 몇 개의 맑은 금빛 사각 별과 작고 부드러운 빛 입자, 중앙 문 실루엣을 가리지 않는 배치. **문·배경·글자·워터마크 없음**. 대부분이 실제 투명 알파인 독립 PNG.
  4. Output Handling: 생성 결과를 검사하고 선택한 출력 파일을 위의 두 프로젝트 경로로 복사한다. 출력이 `$CODEX_HOME/generated_images/...`에만 남지 않게 한다. `view_image`로 최종 PNG를 확인하고 투명 배경·창살 간격·별빛 개수를 점검한다. 자산이 부적합하면 한 번에 한 가지 문제만 수정해 재생성한다.
  5. Error Handling: 내장 imagegen이 실패하면 임의 CSS 도형으로 자산을 대체하거나 API 키가 필요한 CLI를 자동 사용하지 않는다. 도구 실패 사실을 기록하고 가능한 코드·테스트 작업을 계속하되 자산 Task를 완료로 표시하지 않는다.

### I02. 상태별 이미지 겹침

- Related Files:
  - `src/assets/assetManifest.ts` :: `gameAssets.rescueCage`, `gameAssets.exitSparkles` — 새 경로 등록; modify
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite` — `following=false` 때만 철장 이미지 렌더링; modify
  - `src/components/Exit/ExitSprite.tsx` :: `ExitSprite` — 탈출구 행 깊이·플레이어 크기 및 `unlocked=true` 별빛; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.cageOverlay`, `.exitSprite`, `.exitSparkles`, `.exitUnlocked`, `@keyframes` — 크기·위치·레이어·강조 효과; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `unlockedExit`, `ExitSprite` 호출 — 탈출구의 시각 좌표 전달; modify
  - `src/components/MazeBoard/boardDepth.ts` :: `playerDepth(visualRow: number): number`, `wallDepth(visualRow: number): number` — 기존 행 기반 깊이; read-only
  - `src/components/Player/PlayerSprite.tsx` :: `PLAYER_SPRITE_SCALE=1.6`, 행 깊이 및 위치 계산 — 문 정렬 기준; read-only
  - `src/components/MazeBoard/MazeWall.tsx` :: `ObstacleTile`의 `wallDepth(row)` — 장애물 가림 계약; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  gameAssets.rescueCage: '/assets/animals/rescue-cage-overlay.png'
  gameAssets.exitSparkles: '/assets/maps/exit-sparkles.png'
  // RescueSpriteProps.following?: boolean (기본 false)
  // ExitSpriteProps.unlocked: boolean
  // ExitSpriteProps.position: Position (MazeBoard의 gridPosition/시각 좌표)
  // playerDepth(position.row): number
  ```
- **Data & Schema Fields**: `GameState.rescues[].rescued: boolean`가 구출 전/후를, `unlocked = state.rescues.every(target => target.rescued)`가 탈출구 효과를 결정한다. 저장 스키마·ID는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition: `RescueSprite`는 동물 이미지를 `.spriteVisual` 안에 렌더링하고, 동물 이미지 실패 시 바로 다음 형제 `.spriteFallback`을 보여준다. `ExitSprite`는 기본 이모지 뒤에 기존 문 `<img>`를 둔다. 현재 `.exitSprite`는 `1 × cellSize`, `z-index: var(--foreground-depth)`여서 모든 벽 위에 뜬다.
  2. Core Processing: `RescueSprite`의 `.spriteVisual` **밖에** `!following` 조건으로 `aria-hidden`·빈 alt 철장 이미지를 마지막 자식으로 넣어 기존 이미지/폴백 형제 관계를 깨지 않는다. 겹침 요소는 절대 위치·`pointer-events: none`이며 동물 스프라이트 크기에 종속된다. `following=true`에는 철장이 없어야 한다. `ExitSprite`는 기존 문 뒤에 `unlocked` 조건으로 빈 alt·`aria-hidden` 별빛 이미지를 넣는다.
  3. Door Placement: `MazeBoard`가 `isExit` 셀에서 `ExitSprite`에 `position={gridPosition}`(또는 값이 같은 `state.exit`)을 전달한다. `ExitSprite`에서 `--sprite-size: calc(var(--cell-size) * 1.6)`와 `zIndex: playerDepth(position.row)`를 inline style로 준다. `ExitSprite`는 `MazeCell` 안의 상대 좌표이므로 `.exitSprite`를 `width/height: var(--sprite-size)`, `top/left: calc(var(--cell-size) * -0.3)`, `inset:auto`, `overflow:visible`, `transform:none`으로 배치한다. 플레이어의 `(row - 0.3) × cellSize` 전역 위치와 같은 셀 바닥 정렬을 얻는다. 원본 문 이미지의 종횡비는 `object-fit:contain`으로 보존하고 원본 이미지를 왜곡·교체하지 않는다.
  4. Layering & Motion: 철장은 같은 스프라이트 안에서 동물보다 위, 별빛은 같은 exit 안에서 문보다 위다. `.exitSprite`의 정적 `z-index: var(--foreground-depth)`는 제거하고 inline `playerDepth`를 사용한다. `wallDepth(row)=row*2+1`, `playerDepth(row)=row*2+2`이므로 같은 행의 벽 뒤에서는 문이 보이고 **다음 시각 행의 앞쪽 벽**(`row*2+3`)은 문을 가린다. `.playerSprite`와 `WallLayer`의 깊이 함수를 바꾸지 않는다. 열린 문에만 금빛 광채/부드러운 `opacity` 반짝임을 주며 잠김 회색 필터는 유지한다. `prefers-reduced-motion: reduce`에서는 별빛 애니메이션을 제거하되 밝은 정적 이미지로 남긴다.
  5. Error Handling: 철장·별빛 이미지가 로드되지 않으면 해당 `<img>`만 숨기고 기존 동물/문/이모지 폴백은 유지한다. 이미지가 게임 입력을 가리지 않아야 한다.
  6. State Transition: 미구출 동물이 `following` 동료로 바뀔 때 철장은 즉시 사라지고, 마지막 구출 시 `unlockedExit`가 true가 되어 별빛이 나타난다. 게임 로직은 바꾸지 않는다.

### I03. 상태별 검증

- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `MazeBoard`의 구출 전/후·탈출구 잠김/열림 테스트 — 자산 경로·문 크기·깊이 검증; modify
  - `src/components/MazeBoard/MazeWall.test.tsx` :: 기존 장애물 방향 테스트 — 벽 레이어 회귀; read-only

#### Details

- 구출 전 동물 수만큼 철장 이미지가 있고 모두 `/assets/animals/rescue-cage-overlay.png`를 가리키는지 확인한다. 구출 후 follower에는 철장이 없고 동물 이미지는 그대로인지 확인한다.
- 잠긴 탈출구에는 별빛이 없고, 모든 동물을 구출한 상태의 열린 탈출구에는 `/assets/maps/exit-sparkles.png`가 있으며 기존 `/assets/maps/exit.png`도 남아 있는지 확인한다.
- 탈출구 루트의 inline `--sprite-size`가 플레이어와 같은 `calc(var(--cell-size) * 1.6)`인지, `style.zIndex`가 `playerDepth(state.exit.row)`인지 확인한다. 문은 해당 출구 셀의 자식이어야 하며, CSS `top/left`는 `-0.3 × cellSize`여야 한다. `wallDepth(exit.row) < playerDepth(exit.row) < wallDepth(exit.row + 1)` 관계를 확인해 앞쪽 행 장애물이 문 위에 그려지는 계약을 고정한다. 원근감과 실제 가림은 jsdom이 계산하지 못하므로 브라우저에서도 본다.
- `public/assets`의 두 파일이 실제 존재하는지, 투명도가 있는지, 작은 크기에서 뒤 동물이 식별되는지 별도 확인한다. DOM 테스트는 이미지의 미관을 검증하지 못한다.

## Acceptance Criteria

- [x] 새 투명 PNG 두 개가 프로젝트에 저장되고 동물·문 원본은 유지된다.
- [x] 미구출 동물에만 철장이 보이고 구출 후 동료에는 없다.
- [x] 별빛은 모든 동물을 구출한 열린 문에서만 보이며 잠긴 문은 구분된다.
- [x] 문은 플레이어처럼 `1.6 × cellSize`로 셀 바닥에 정렬되고 행 기반 깊이로 앞쪽 장애물 뒤에 놓인다. (DOM 깊이 계약 확인, 실제 화면 육안 확인 미실시)
- [x] 애니메이션 감소 설정과 이미지 로드 실패에서도 게임 표시가 유지된다.

## Validation

- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/MazeBoard/MazeWall.test.tsx` — 철장·별빛·문 크기·행 깊이 및 벽 회귀 통과.
- `npm.cmd test -- --run` — 전체 회귀 통과.
- `npm.cmd run build` — 자산 참조와 타입/번들 통과.
- `Test-Path -Path public/assets/animals/rescue-cage-overlay.png,public/assets/maps/exit-sparkles.png` — 둘 다 True.
- `view_image`로 두 PNG와 브라우저의 작은 셀·모바일 렌더링 확인. 특히 문 아래쪽이 출구 셀에 자연스럽게 붙고 앞쪽 장애물이 문을 적절히 가리는지 확인한다. 브라우저가 연결되지 않으면 미실시 사실 기록.

## Commit Message

```text
feat(game): 동물 철장과 열린 탈출구 별빛 추가

Plan: 2026-10-02-caged-animals-sparkling-exit-rescue-notice
Phase: P01-rescue-feedback
Task: T01-cage-and-exit-art

- 미구출 동물에 투명 철장 자산을 겹쳐 표시
- 기존 탈출구를 플레이어 크기·행 깊이로 정렬하고 금빛 별빛 강조
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (대상 28개, 전체 134개, 빌드, PNG 존재·알파 검사)
- [ ] 브라우저 육안 확인 (연결된 브라우저가 없어 수행 불가)
- commit: Git 기록 참조
