# Task: T05 방향별 캐릭터와 테마 보드 표시

## Status: done

## Goal
T01·T01A·T02·T03의 로컬 이미지를 T04의 방향 상태 및 기존 미로 seed와 연결해 게임 화면에 4방향 캐릭터, 발 교대 걷기, 동물 점프와 무작위 테마의 입체 벽·바닥을 안정적으로 표시한다.

## Decision Summary
- 새 미로의 seed가 숲·사탕·얼음·사막 중 하나와 셀별 변형을 결정한다. 동일 seed는 같은 테마와 변형을 재현하며 연속 테마 반복은 허용한다.
- 여자·남자 플레이어는 마지막 입력 방향을 보고 실제로 이동한 경우에만 짧은 걷기 효과를 받는다. 구조 대기 동물은 정면에서 정지하고, 팔로워는 각자의 실제 이동 방향을 보며 그 팔로워가 칸을 옮긴 경우에만 작은 점프 효과를 받는다.
- 탐험가의 발 교대는 T01A의 방향별 `walk-a`/`walk-b` PNG를 순서대로 표시한다. 동물의 작은 점프만 기존 방향 PNG에 CSS 변형을 적용한다. 움직임 재생 여부는 저장하지 않는다.
- 기존 미로 벽·통로·충돌·카메라 규칙을 유지하고 탐험가 선택 화면은 새 정면 이미지를 사용한다.

## Implementation

### I01. 로컬 에셋 계약과 seed 기반 테마 선택

- Related Files:
  - `src/assets/assetManifest.ts` :: `gameAssets.player`, 신규 `playerSprites`·`playerWalkSprites`, `rescueAnimals`, 신규 `mazeThemes`, `MazeThemeAssets`; modify
  - `src/assets/mazeTheme.ts` :: `MAZE_THEMES`, `MazeThemeId`, `getMazeTheme`, `getFloorVariant`, `getWallVariant`; new
  - `src/assets/mazeTheme.test.ts` :: seed 재현성과 변형·테마 범위 검증; new
  - `src/game/mazeGenerator.ts` :: 기존 `createSeededRandom`; read-only
  - `public/assets/players/player-{girl|boy}-{front|back|left|right}.png` :: T01 결과; read-only
  - `public/assets/players/player-{girl|boy}-{front|back|left|right}-walk-{a|b}.png` :: T01A 결과; read-only
  - `public/assets/animals/rescue-{rabbit|fox|bear|cat|dog}-{front|back|left|right}.png` :: T02 결과; read-only
  - `public/assets/maps/maze-{forest|candy|ice|desert}-floor-{01|02}.png`, `maze-{forest|candy|ice|desert}-wall-{01|02|03}.png` :: T03 결과; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  const MAZE_THEMES = ['forest', 'candy', 'ice', 'desert'] as const
  type MazeThemeId = (typeof MAZE_THEMES)[number]
  interface MazeThemeAssets {
    floor: readonly [string, string]
    wall: readonly [string, string, string]
    floorColor: string
    wallColor: string
  }
  const playerSprites: Record<PlayerAppearance, Record<Direction, string>>
  const playerWalkSprites: Record<PlayerAppearance, Record<Direction, readonly [string, string]>>
  const mazeThemes: Record<MazeThemeId, MazeThemeAssets>
  function getMazeTheme(seed: number): MazeThemeId
  function getFloorVariant(seed: number, row: number, col: number): 0 | 1
  function getWallVariant(seed: number, row: number, col: number, side: Direction): 0 | 1 | 2
  ```
- **Data & Schema Fields**:
  - `gameAssets.player.girl/boy`는 새 정면 PNG 경로를 사용하며 `PlayerAppearancePicker`가 이를 표시한다.
  - `playerSprites[appearance]`: `up→back`, `down→front`, `left→left`, `right→right`의 PNG 경로 4개. 여자·남자 각각 T01 파일을 가리킨다.
  - `playerWalkSprites[appearance][direction]`: 같은 방향 매핑으로 T01A의 `[walk-a, walk-b]` 경로를 보관한다. 정지 이미지는 `playerSprites`에 남기고 선택 화면의 정면 이미지는 `gameAssets.player`에 둔다.
  - `rescueAnimals[i].image`: 새 정면 PNG 경로를 사용한다. 신규 `sprites: Record<Direction,string>`는 같은 방향 매핑으로 T02의 각 동물 파일을 가리킨다. 기존 배열 순서와 `getRescueAnimal(id)`의 ID 대응은 바꾸지 않는다.
  - `mazeThemes[theme].floor`는 T03의 `01`, `02` 경로 순서의 2요소 튜플이고 `wall`은 `01`, `02`, `03` 경로 순서의 3요소 튜플이다. `floorColor`, `wallColor`는 이미지 오류 시에도 길과 닫힌 벽을 구분할 수 있는 테마별 대비 색상이다.
  - 기본색은 `forest: floorColor '#dce9b5', wallColor '#557b4a'`, `candy: '#ffe1ed'/'#d3578a'`, `ice: '#dff5fb'/'#5da9ca'`, `desert: '#f6dca8'/'#b47a3c'`를 사용한다.
  - 테마와 타일 변형은 저장 필드가 아니다. `state.maze.seed`로 매 렌더마다 같은 결과를 계산한다.
- **Execution Flow / Logic**:
  1. `getMazeTheme`는 `createSeededRandom((seed ^ 0x5448454d) >>> 0)()`의 첫 값을 4등분해 위 배열에서 선택한다. 미로 생성에 사용되는 난수 상태를 소비하거나 바꾸지 않는다. 비정상 seed는 기존 미로 검증 대상이며 유효한 32비트 정수만 들어온다.
  2. 바닥·벽 변형의 공통 seed 혼합은 `(seed ^ Math.imul(row + 1, 0x9e3779b1) ^ Math.imul(col + 1, 0x85ebca6b) ^ salt) >>> 0`이다. 바닥은 `createSeededRandom(mixed)() < 0.5 ? 0 : 1`로, 벽은 `Math.floor(createSeededRandom(mixed)() * 3)`으로 0·1·2 중 하나를 정한다. 바닥 salt는 `0x464c4f52`, 벽 side salt는 `up: 0x544f5001`, `right: 0x52474802`, `down: 0x42545403`, `left: 0x4c465404`로 고정한다. 상단/하단 벽은 각각 함수에 `'up'`/`'down'`을 전달한다. `Math.random()`이나 렌더 횟수에 의존하지 않는다.
  3. 새 미로는 새 seed로 테마가 재추첨되고, 같은 미로 재도전·저장 후 이어하기는 같은 seed로 동일 테마·셀 변형을 재현한다. 새 seed에서 이전과 같은 테마가 나와도 정상이다.
  4. `mazeTheme.test.ts`에는 동일 seed 반복 결과, 네 테마 중 하나만 반환, 좌표/방향별 바닥 변형이 항상 0·1이고 벽 변형이 0·1·2이며, 여러 seed에서 네 테마 모두 선택 가능함을 검증한다.
- **Error & Exception Handling**: 이미지 요청 실패 시 CSS의 `floorColor`·`wallColor`가 길과 벽을 유지한다. 캐릭터 에셋 실패 시 기존 이모지 대체 표시를 유지한다.

### I02. 방향별 캐릭터와 움직임

- Related Files:
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite`의 중립·발 교대 프레임 선택과 타이머 정리; modify
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite`; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`의 스프라이트 props와 직전·현재 위치 기반 이동 판정 연결; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.sprite`, `.playerSprite`, `.followerSprite`, 걷기 보조 움직임·동물 점프 키프레임; modify
  - `src/components/Player/PlayerAppearancePicker.tsx` :: 새 정면 이미지 사용 확인; read-only
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 방향별 경로·대체 이미지 검증; modify
  - `src/App.test.tsx` :: 탐험가 선택 시 정면 이미지 확인; modify

#### Details
- **Signatures & Types**:
  ```typescript
  function PlayerSprite(props: { appearance?: PlayerAppearance; facing: Direction; moveCount: number; animateMove: boolean }): JSX.Element
  interface RescueSpriteProps {
    animalId: string
    facing?: Direction
    following?: boolean
    order?: number
    moveCount?: number
    animateMove?: boolean
  }
  function RescueSprite(props: RescueSpriteProps): JSX.Element
  ```
  반환 타입은 프로젝트의 React 타입 설정에 맞게 추론시켜도 된다. props 이름과 의미는 유지한다.
- **Data & Schema Fields**: 새 저장 필드는 T04의 `GameState.playerFacing`과 `followerFacings`만 사용한다. `moveCount`는 기존 필드이며 움직임 효과를 재시작하는 렌더 키로 사용한다. `animateMove`와 직전 위치 스냅샷은 렌더러 내부의 일시적 표시 정보이며 저장하지 않는다.
- **Execution Flow / Logic**:
  1. `MazeBoard`는 `PlayerSprite`에 `appearance`, `state.playerFacing`, `state.moveCount`를 전달한다. 구출 대기 `RescueSprite`는 `facing='down'`으로 정면 이미지를 사용한다. 팔로워 `i`는 현재 구조 완료 순서에 해당하는 동물과 `state.followerFacings[i] ?? 'down'`을 사용한다. 기존 `rescues`의 구조 완료 순서와 follower index 매핑을 바꾸지 않는다.
  2. 두 컴포넌트는 `direction`에 맞는 `playerSprites`/`rescueAnimals[i].sprites` 경로를 `<img>`에 넣고 `data-facing` 속성을 제공한다. 기존 `role='img'`, 한국어 `aria-label`, `data-asset-slot`, 이모지 fallback 및 이미지 오류 시 `hidden` 동작을 유지한다. 투명 PNG 뒤로 이모지가 비치지 않도록 fallback은 이미지 오류일 때만 보인다. 경로가 바뀌면 `<img key={src}>`로 오류 표시 상태를 새 이미지에 남기지 않는다.
  3. `MazeBoard`는 최초 렌더에서 현재 `moveCount`, `maze.seed`, `player`, `followers`를 `useRef`에 기록하고 움직임을 재생하지 않는다. 이후 `useLayoutEffect`에서 직전 스냅샷과 현재 상태를 비교한다. 같은 미로 seed에서 `moveCount === previous.moveCount + 1`이고 플레이어 위치가 바뀐 경우에만 이번 턴의 `playerMoved=true`를 설정한다. 각 팔로워 `i`는 이전 목록에 같은 인덱스가 있고 그 위치가 실제로 달라졌을 때만 `followerMoved[i]=true`로 설정한다. 새로 합류한 팔로워, 겹쳐서 제자리인 팔로워, 벽 입력, 최초 렌더, 저장 후 재진입, 재시작은 모두 재생하지 않는다. 비교 뒤 스냅샷을 갱신한다. `moveCount`가 같으면 모션 판정을 다시 만들지 않는다.
  4. `MazeBoard`는 플레이어와 팔로워에게 각각 `animateMove`를 전달한다. 효과 상태에는 대상 `moveCount`를 함께 보관하고, 현재 카운트와 같을 때만 효과를 시작해 이전 턴 효과가 새 렌더에 남지 않게 한다. 팔로워의 시각 요소는 `moveCount` 키로 CSS 점프를 재시작한다. 두 컴포넌트는 재생 시 `data-motion='walk'` 또는 `data-motion='hop'`, 그 외에는 `data-motion='none'`을 제공해 테스트할 수 있게 한다.
  5. `PlayerSprite`는 평소 해당 방향의 T01 중립 PNG를 보여 준다. `animateMove`와 새로운 `moveCount`를 받으면 현재 방향 T01A의 `walk-a`, `walk-b`를 각각 약 80ms 표시한 뒤 중립 PNG로 돌아간다. 다음 성공 이동은 시작 자세를 반대로 해서 `walk-b→walk-a→중립` 순서로 재생한다(`moveCount` 홀짝 사용). 연속 입력에는 이전 타이머를 정리하고 새 카운트의 순서를 처음부터 재생한다. 방향만 바뀐 막힌 입력, 첫 렌더, 저장 복원과 `prefers-reduced-motion: reduce`에서는 중립 PNG만 표시한다. 모션 감소 설정은 `matchMedia`로 이미지 교대 자체를 막는다. CSS로는 몸 전체를 최대 1px만 들어 올려 보조할 수 있으며 발 자세는 반드시 이미지 교대로 표현한다.
  6. 동물의 `hop`은 약 220ms 동안 위로 최대 3px 올라갔다가 내려오며 착지 시 가로·세로 크기를 약 3% 이내로 살짝 압축·복원한다. CSS 변형은 보드 카메라의 `transform`이 아닌 스프라이트의 안쪽 시각 요소에 적용한다. `prefers-reduced-motion: reduce`에서는 점프와 플레이어 보조 움직임을 끈다. 효과가 이미지 실패 이모지나 접근성 이름을 숨기지 않게 한다.
  7. 현재 원형 배경과 그림자는 새 투명 SD 캐릭터가 바닥에서 읽히도록 조정하되 36px 셀에서 캐릭터가 장애물 아래에 묻히지 않게 한다. `ExitSprite`의 열림/잠김 표현은 유지한다.
  8. 테스트 픽스처에서 `followers`를 수동 추가할 때 `followerFacings`도 같은 길이로 지정한다. 현재 기본 경로 `/assets/players/player-boy-front.png`와 `/assets/animals/rescue-dog-front.png`를 게임 이미지로 기대한 테스트는 방향별 경로로 갱신하되, 선택 버튼은 정면 이미지 경로를 기대한다. `MazeBoard.test.tsx`는 첫 렌더·막힌 입력의 `data-motion='none'`, 실제 이동 후 플레이어의 `walk-a→walk-b→중립` 및 다음 이동의 역순, 실제로 이동한 팔로워만 `hop`, 새로 합류한 동물 `none`을 각각 검증한다. 모션 감소 설정에서는 이미지 경로가 중립으로 유지되는지 확인한다.
- **Error & Exception Handling**: 특정 방향 PNG가 실패해도 해당 캐릭터의 이모지 fallback을 보이고 조작·구조 진행은 유지한다.

### I03. 테마 바닥과 경계별 입체 장애물

- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: seed에서 테마 선택 후 보드에 전달; modify
  - `src/components/MazeBoard/MazeCell.tsx` :: `MazeCell`의 테마·변형·경계 장식 렌더링; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: 테마 바닥, 닫힌 경계 막대·장애물 블록, 반응형; modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 벽 중복 방지·테마 안정성·셀 수·카메라 회귀; modify
  - `src/components/GameScreen/GameScreen.tsx` :: 현재 `MazeBoard` state 전달 계약 확인; read-only
  - `README.md` :: 방향 그래픽과 새 미로 테마·저장 호환 사용 설명; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface MazeCellProps {
    cell: Cell
    type: 'floor' | 'player' | 'rescue' | 'follower' | 'exit'
    seed: number
    mazeSize: number
    theme: MazeThemeAssets
    children?: ReactNode
  }
  function MazeBoard(props: MazeBoardProps): JSX.Element
  function MazeCell(props: MazeCellProps): JSX.Element
  ```
- **Data & Schema Fields**: 보드의 `data-theme`는 `MazeThemeId`; 각 셀의 `data-row`, `data-col`, `data-cell-type`와 기존 `wallTop/Right/Bottom/Left` 클래스는 유지한다. 장식 요소에는 `aria-hidden='true'`를 지정한다.
- **Execution Flow / Logic**:
  1. `MazeBoard`는 `getMazeTheme(state.maze.seed)`로 한 테마를 정하고 `mazeThemes[themeId]`, `seed`, `mazeSize`를 모든 `MazeCell`에 전달한다. 카메라 계산, `--cell-size`, 보드 grid 및 목표 렌더 순서는 유지한다.
  2. 각 셀의 바닥 이미지 `theme.floor[getFloorVariant(seed,row,col)]`를 CSS 변수 또는 inline style로 적용한다. 파일이 없어도 `theme.floorColor`가 보이도록 CSS 기본색을 함께 지정한다. 기존 단일 `maze-floor.png` 반복 스타일은 게임 보드에서 제거한다.
  3. 논리 셀 중심을 `2r+1, 2c+1`의 시각 타일로 투영하고 경계 타일은 두 중심 사이에 둔다. 닫힌 경계에만 `theme.wall[getWallVariant(...)]` 입체 블록 이미지를 표시하고 열린 경계는 바닥 통로로 남긴다. 공유 경계는 **아래쪽 셀의 top 또는 오른쪽 셀의 left**에서 한 번만 그린다. `right`는 `col === mazeSize - 1`, `bottom`은 `row === mazeSize - 1`인 바깥 경계에서만 그린다. 충돌 계산에 쓰는 `cell.walls`는 바꾸지 않는다.
  4. 장애물 이미지는 시각 타일 안에 들어오도록 크기를 맞춘다. 캐릭터가 서는 중심 타일과 장애물 타일이 겹치지 않도록 하고 카메라는 확장된 시각 격자의 중심 좌표를 따른다. `pointer-events: none`, `aria-hidden`을 유지한다. 이미지 오류 시에는 해당 위치에 테마 색상의 대체 블록을 표시한다.
  5. `MazeBoard.test.tsx`에서 15×15·33×33 셀 개수 및 카메라 clamp 결과를 유지하고, 같은 seed에 `data-theme`·바닥/벽 변형이 고정되는지 확인한다. 수동 구조 상태 테스트는 방향 필드 배열을 같이 맞춘다. README에는 테마가 단계 구간 고정이 아니라 새 미로마다 무작위이며 같은 미로에서는 유지된다고 설명한다.
- **Error & Exception Handling**: 바닥 PNG가 실패하면 테마 기본색, 장애물 PNG가 실패하면 닫힌 경계의 작은 대체 블록이 남아 통로 판독이 가능하다. 모바일과 36px 셀에서도 장식이 클릭·터치·키보드 이동을 가로막지 않는다.

## Acceptance Criteria
- [x] 탐험가 2종과 구조 동물 5종이 정면·뒤·좌·우의 올바른 로컬 이미지를 보여 주고 탐험가 선택 화면은 새 정면 파일을 사용한다.
- [x] 같은 seed의 미로는 테마·바닥·벽 변형이 같고 새 seed에서 네 테마 중 하나를 선택한다.
- [x] 닫힌 경계에만 입체 블록이 한 번 나타나고 기존 길·충돌·카메라·목표 동작이 유지된다.
- [x] 벽 입력 시 방향만 바뀌며, 성공한 이동 효과는 모션 감소 설정에서 꺼진다.
- [x] 여자·남자 플레이어는 실제 이동 때만 해당 방향의 A/B 발 자세를 번갈아 표시하고 중립으로 돌아온다. 기존 팔로워 중 실제로 이동한 동물만 작은 점프를 하며 대기·신규 합류·정지 동물은 뛰지 않는다.
- [x] 이미지 오류·오프라인 상태에서도 캐릭터와 통로를 식별할 수 있다.

## Validation
- `npm test -- --run src/assets/mazeTheme.test.ts src/components/MazeBoard/MazeBoard.test.tsx src/App.test.tsx` — 테마 재현성, 방향 렌더링, 걷기·점프 재생 조건, 정면 선택 이미지 및 보드 회귀가 통과.
- `npm run build` — 앱의 에셋 경로·타입·반응형 스타일을 포함한 빌드 통과.
- `npm run dev` — 브라우저에서 15×15 및 33×33, 36px 모바일 셀, 플레이어 걷기·동물 점프·정지/벽 입력·모션 감소 설정, 새 미로·같은 미로 재도전·이어하기, 이미지 실패 대체 표시를 확인.

## Commit Message
```text
feat(ui): 방향별 캐릭터와 무작위 테마 보드 연결

Plan: 2026-09-29-character-and-maze-visual-variety
Phase: P01-visual-variety
Task: T05-themed-board-rendering

- 탐험가의 방향별 발 교대 프레임·실제 이동한 구조 동물의 점프 효과 연결
- seed 기반 테마 바닥 및 닫힌 경계 입체 장애물 표시
- 정면 이미지와 오프라인 대체 표시, 반응형 보드 유지
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 — 전체 84개 테스트, 빌드, 로컬 에셋 64개 존재 및 Vite HTTP 200 확인. 현재 연결된 브라우저가 없어 화면 육안 확인은 별도 필요.
- commit: `feb1a37`
- 화면 피드백 수정 commit: `eff4c3a` — 투명 캐릭터 뒤 이모지를 이미지 오류 때만 표시하고, 색상 막대 대신 3종 장애물 PNG를 닫힌 경계에 표시. 전체 84개 테스트와 빌드 통과.
- 이동 경로 수정 commit: `0b6c926` — 논리 셀 중심과 경계에 별도 시각 타일을 두고 장애물을 타일 범위 안에 표시. 열린 통로·플레이어 칸과 장애물 칸이 겹치지 않는지 검증. 전체 85개 테스트와 빌드 통과.

- 화면 밀도 보정 commit: `7a068f1` — 논리 한 칸 간격을 기존 36~52px로 복원하고, 막힌 경계에 인접한 모서리만 장애물 이미지로 연결. 전체 85개 테스트와 빌드 통과.


- 이동 입력 확인 commit: `a8e3921` — MOVE 1회는 논리 좌표 1칸, 시각 좌표 2개(중간 통로 포함) 전진함을 화면 테스트로 확인. 키보드 반복 keydown은 무시해 한 번 누를 때 추가 이동이 일어나지 않도록 수정. 관련 17개 테스트와 빌드 통과.

