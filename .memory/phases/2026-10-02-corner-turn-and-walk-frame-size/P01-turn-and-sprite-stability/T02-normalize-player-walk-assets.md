# Task: T02 남녀 걷기 이미지 크기 안정화

## Status: done

## Goal

남녀 캐릭터 네 방향의 걷기 A/B PNG 16개에서 캐릭터가 기본 이미지보다 커졌다 작아졌다 보이는 문제를 제거한다. 발 위치와 보이는 몸 높이를 맞추면서 두 걷기 자세와 제자리 걷기를 유지한다.

## Decision Summary

- 수정 대상은 `girl`·`boy` × `front`·`back`·`left`·`right` × `walk-a`·`walk-b`의 16개 PNG다. 각 방향의 기본 PNG는 변경하지 않고 크기·발 기준선 참조로 사용한다.
- 1254×1254 투명 캔버스, 캐릭터의 얼굴·의상·색·소품 및 서로 다른 걷기 자세를 보존한다. `PlayerSprite`의 1.6칸 표시 크기나 게임 이동·충돌 규칙은 바꾸지 않는다.

## Implementation

### I01. 원본 비교와 걷기 PNG 16개 교정

- Related Files:
  - `public/assets/players/player-girl-front-walk-a.png`, `public/assets/players/player-girl-front-walk-b.png` — 여자 정면 걷기; modify
  - `public/assets/players/player-girl-back-walk-a.png`, `public/assets/players/player-girl-back-walk-b.png` — 여자 뒷모습 걷기; modify
  - `public/assets/players/player-girl-left-walk-a.png`, `public/assets/players/player-girl-left-walk-b.png` — 여자 왼쪽 걷기; modify
  - `public/assets/players/player-girl-right-walk-a.png`, `public/assets/players/player-girl-right-walk-b.png` — 여자 오른쪽 걷기; modify
  - `public/assets/players/player-boy-front-walk-a.png`, `public/assets/players/player-boy-front-walk-b.png` — 남자 정면 걷기; modify
  - `public/assets/players/player-boy-back-walk-a.png`, `public/assets/players/player-boy-back-walk-b.png` — 남자 뒷모습 걷기; modify
  - `public/assets/players/player-boy-left-walk-a.png`, `public/assets/players/player-boy-left-walk-b.png` — 남자 왼쪽 걷기; modify
  - `public/assets/players/player-boy-right-walk-a.png`, `public/assets/players/player-boy-right-walk-b.png` — 남자 오른쪽 걷기; modify
  - `public/assets/players/player-{girl,boy}-{front,back,left,right}.png` — 각 걷기 이미지의 크기·발 기준선 참조 8개; read-only
  - `src/assets/assetManifest.ts` :: `playerSprites`, `playerWalkSprites` — 방향과 파일 이름 매핑; read-only
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite`, `PLAYER_SPRITE_SCALE` — 동일 상자에서 기본·걷기 PNG 교체; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type Appearance = 'girl' | 'boy'
  type AssetSide = 'front' | 'back' | 'left' | 'right'
  type WalkFrame = 'a' | 'b'
  // base: player-${Appearance}-${AssetSide}.png
  // target: player-${Appearance}-${AssetSide}-walk-${WalkFrame}.png
  ```
- **Data & Schema Fields**: 8개 기본·16개 걷기 PNG는 모두 현재 1254×1254, 8비트 RGBA, 투명 배경이다. 새 자산 경로·게임 상태·API·저장 필드는 없다. `playerWalkSprites`의 기존 경로가 수정된 파일을 그대로 참조하게 한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 각 세트의 기본·걷기 A/B 원본을 `view_image`로 비교하고 실제 불투명 그림 범위와 발 높이를 기록한다. 여자 정면은 기존 조사에서 보이는 높이가 기본 1011px, A 1033px, B 1084px이므로 교정이 필요한 사례다. 원본 Git 버전이 남아 있으므로 실패한 결과는 채택하지 않는다.
  2. Image Editing: `imagegen` 스킬의 내장 `image_gen` 편집 도구를 사용한다. **걷기 PNG 하나당 한 번** 호출하고 해당 걷기 파일을 편집 대상, 같은 인물·방향의 기본 PNG를 크기·발 위치 참조로 전달한다. `transparent_background: true`로 배경 알파를 유지한다. 프롬프트의 고정 조건은 “기존 얼굴·헤어·의상·등불·색·윤곽·걷기 발 자세를 보존하고, 캐릭터 전체의 보이는 높이와 바닥에 닿는 발 기준선만 기본 PNG와 맞춘다. 배경은 완전 투명, 추가 요소·글자 없음”이다.
  3. Canvas Normalization: 생성물이 1254×1254가 아니거나 내부 여백이 맞지 않으면 투명 1254×1254 캔버스에 **균일 비율**로만 맞춰 넣는다. 최종 알파 그림의 높이가 같은 세트의 기본 그림 높이와 같도록 비율을 계산하고, 최종 알파 그림의 아래쪽 끝을 기본 그림의 아래쪽 끝에 맞춘다. 수평 중심은 기본 그림 중심에 맞춘다. 가로·세로를 다른 배율로 늘리지 않는다. 이 기계적 리샘플링은 .NET `System.Drawing` 또는 동급의 로컬 이미지 도구로 수행하며 Python 이미지 편집은 사용하지 않는다.
  4. Review & Replacement: 각 결과를 기본·A·B와 나란히 검사한다. 얼굴이나 소품이 바뀌거나, 두 발 자세가 같아지거나, 흰 배경·거친 가장자리·잘린 부분이 생기면 그 결과를 교체하지 않고 해당 프레임만 다시 편집한다. 통과한 결과만 기존 16개 대상 경로에 저장한다. `assetManifest.ts`·기본 PNG·구출 동물 PNG는 수정하지 않는다.
  5. State Transition & Return: 이미지 파일만 교체되므로 `PlayerSprite`의 걷기 프레임 선택과 장애물 앞 제자리 걷기 상태 전이는 현재 코드 그대로다.

### I02. PNG 내부 그림 크기 검사기

- Related Files:
  - `scripts/check-player-frame-bounds.mjs` :: `readPngAlphaBounds`, `paethPredictor`, `checkFramePair` — 16개 걷기 PNG의 실제 그림 범위 검증; new
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 막힌 여자 정면과 네 방향 제자리 걷기 테스트 — 런타임 교체 동작 회귀; read-only

#### Details

- **Signatures & Types**:
  ```javascript
  /** @typedef {{ width: number, height: number, left: number, top: number, right: number, bottom: number, visibleHeight: number }} AlphaBounds */
  /** @param {number} left @param {number} above @param {number} upperLeft @returns {number} */
  function paethPredictor(left, above, upperLeft) {}
  /** @param {string} filePath @returns {AlphaBounds} */
  function readPngAlphaBounds(filePath) {}
  /** @param {'girl'|'boy'} appearance @param {'front'|'back'|'left'|'right'} side @param {'a'|'b'} frame @returns {boolean} */
  function checkFramePair(appearance, side, frame) {}
  ```
- **Data & Schema Fields**: `AlphaBounds`의 좌표는 1254×1254 캔버스에서 알파가 16 이상인 픽셀의 최소·최대 x/y이다. `visibleHeight = bottom - top + 1`이다. 파일이나 로그 외의 영속 스키마는 없다.
- **Execution Flow / Logic**:
  1. `node:fs`로 PNG 서명과 IHDR을 확인하고 폭·높이 1254, bit depth 8, color type 6(RGBA), interlace 0을 요구한다. IDAT 청크를 이어 `node:zlib.inflateSync`으로 풀고 PNG 행 필터 0~4(None/Sub/Up/Average/Paeth)를 4 bytes-per-pixel로 복원한다. 형식이 잘못되거나 알파 픽셀이 없으면 명시적으로 실패한다. 새 npm 패키지를 설치하지 않는다.
  2. 8개 기본 이미지 각각에 대해 걷기 A/B의 `visibleHeight` 차이가 기본 높이의 1% 이내인지, `bottom` 차이가 8px 이내인지 검사한다. PNG 네 모서리는 알파 0이어야 한다. A/B가 바이트 단위로 동일하면 발 자세가 사라진 것으로 보고 실패한다. 각 파일의 높이·bottom·기본 대비 차이를 표로 출력하고 하나라도 실패하면 프로세스 종료 코드를 1로 한다.
  3. 검사기는 투명 여백과 발 기준선의 **기하학적 차이**만 잡는다. 얼굴·의상·걷기 발 자세의 동일성은 I01의 사람 눈 비교로 확인한다. 기존 DOM 테스트는 `<img>`와 표시 상자의 크기만 확인하므로 이 검사기를 대신하지 못한다.

## Acceptance Criteria

- [x] 걷기 PNG 16개 모두 1254×1254의 투명 RGBA이며 기본 PNG 대비 보이는 높이 차이 1% 이내, 아래쪽 기준선 차이 8px 이내다.
- [x] 남녀 네 방향 각각에서 기본·A·B 전환 시 몸 크기가 튀지 않고 A/B의 서로 다른 걷기 자세가 보인다.
- [x] 원래 캐릭터 디자인과 소품, 기존 이미지 경로, 1.6칸 표시 상자, 막힌 상태 제자리 걷기와 정상 이동 애니메이션이 유지된다.
- [x] 이미지 검사기와 기존 게임 테스트·빌드가 통과한다.

## Validation

- `node scripts/check-player-frame-bounds.mjs` — 기본 8개와 걷기 16개의 PNG 구조·실제 높이·아래쪽 기준선·A/B 구분 검사 통과.
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 막힌 상태와 정상 이동의 PNG 선택 및 제자리 걷기 회귀 통과.
- `npm.cmd test -- --run` — 전체 회귀 통과.
- `npm.cmd run build` — 타입 검사와 PNG 포함 번들 통과.
- `view_image`로 8세트의 기본·A·B를 직접 비교하고, 브라우저가 연결되면 아래쪽 장애물 앞 여자 캐릭터와 남녀 네 방향의 연속 제자리 걷기를 실제 게임 크기에서 확인한다. 브라우저가 없으면 미실시를 기록한다.

## Commit Message

```text
fix(assets): 남녀 걷기 프레임의 보이는 크기 통일

Plan: 2026-10-02-corner-turn-and-walk-frame-size
Phase: P01-turn-and-sprite-stability
Task: T02-normalize-player-walk-assets

- 남녀 네 방향 걷기 PNG의 발 기준선과 몸 높이 정렬
- PNG 내부 그림 범위 검사기 추가
```

## Progress

- [x] 구현 완료: 기존 16개 중 기준을 벗어난 7개 PNG만 원본 그림을 균일 비율로 축소하고 발 기준선에 정렬. `image_gen` 시안은 얼굴·등불 세부가 변형되어 채택하지 않음.
- [x] 검증 통과: PNG 검사 16/16, 지정 테스트 35개, 전체 테스트 133개, 빌드, 8세트 직접 이미지 비교. 연결된 브라우저가 없어 실제 게임 화면 검사는 미실시.
- commit: Git 기록 참조
