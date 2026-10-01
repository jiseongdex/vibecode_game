# Task: T02 지그재그 탐험 경로와 탐험가 선택

## Status: done

## Goal

20개 단계가 넓은 화면에서는 5열×4행, 좁은 화면에서는 2열×10행의 연결된 지그재그 길로 보이게 한다. 한눈에 단계 상태를 읽고, 키보드/터치로 단계와 탐험가를 선택할 수 있다.

## Decision Summary

- 따뜻한 종이 지도 위에 말랑한 스티커 카드와 잎·버섯·발자국 SVG 장식을 쓴다.
- 실제 미로 바이옴은 시드로 정해지므로 단계 번호에 숲/얼음/사탕/사막을 고정 매핑하지 않는다.
- 단계의 DOM 및 Tab 순서는 1→20을 유지하고, 시각 배치만 지그재그로 만든다. 잠금/완료/진행 가능 상태는 글·아이콘/모양으로도 구별한다.

## Implementation

### I01. 경로 좌표와 단계 카드

- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreen`, `startStage`, 단계 1..MAX_STAGE 렌더링; modify
  - `src/components/Campaign/CampaignScreen.module.css` :: `.campaign`, `.grid`, `.stage`, 상태/반응형 규칙; modify
  - `src/components/Decorations/StickerIcon.tsx` :: T01에서 만든 장식 사용; read-only
  - `src/game/campaignProgress.ts` :: `CampaignProgress.unlockedStage`, `stageRecords` 형태 참조; read-only
  - `src/game/stageConfig.ts` :: `MAX_STAGE`=20 참조; read-only

#### Details

- **Signatures & Types**: 기존 `CampaignScreenProps { progress: CampaignProgress; appearance: PlayerAppearance; onAppearanceChange: (appearance: PlayerAppearance) => void; onStartSession: (session: GameState) => void }`를 유지한다. 지역 함수 `routePosition(stage: number, columns: 5 | 2): { row: number; col: number; next: 'left' | 'right' | 'down' | 'end' }`를 둘 수 있다. 1-based `row=floor((stage-1)/columns)+1`, `slot=(stage-1)%columns`, `col=(row%2===1 ? slot : columns-1-slot)+1`. 마지막 단계 `next='end'`; 행 끝이면 `down`, 나머지는 홀수 행 `right`, 짝수 행 `left`.
- **Data & Schema Fields**: 각 단계 wrapper 또는 button에 CSS 변수 `--desktop-row`, `--desktop-col`, `--mobile-row`, `--mobile-col`(모두 1-based number)을 전달한다. 데스크톱/모바일 연결선 방향을 `data-desktop-next`, `data-mobile-next`로 표현한다. 이들은 화면 배치 데이터일 뿐 저장 데이터가 아니다. 기존 `CampaignProgress.stageRecords[stage].bestTimeSeconds` 및 `unlockedStage`는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. `Array.from({ length: MAX_STAGE }, (_, i) => i+1)`의 자연스러운 DOM 순서와 `startStage`의 locked guard를 유지한다. 각 단계의 5열/2열 위치와 다음 단계 방향을 계산한다.
  2. 지도 컨테이너에 5열 CSS grid를 사용하고 각 노드를 계산된 `grid-row`/`grid-column`에 놓는다. 모바일 기준은 `@media (max-width: 700px)`로 2열 좌표를 사용한다. 320px 너비에서도 카드 텍스트가 잘리지 않게 열 최소 너비·gap·padding을 조정한다. 700px 근처에서 5열 카드 폭이 부족하다면 기준을 조금 더 넓혀도 되지만 데스크톱 5×4와 모바일 2열은 유지한다.
  3. 노드의 `::after` 등 장식용 pseudo element가 다음 카드 중심까지 가는 점선 경로를 그린다. 방향이 `right/left`면 카드 중심에서 인접 열 중심까지 `셀 너비 + column-gap`, `down`이면 다음 행 중심까지 `셀 높이 + row-gap`만큼 그린다. 마지막 단계에는 연결선을 그리지 않는다. 지도 배경과 점선은 버튼보다 뒤에 두고 `pointer-events:none`으로 한다. CSS media query에서 desktop/mobile 방향을 각각 선택한다.
  4. 단계 카드는 캡슐에 가까운 둥근 스티커 외형과 누를 수 있는 표면/그림자를 가진다. `record`면 완료 색과 `최고 MM:SS`, `locked`면 잠금 글/모양, 열린 미완료 단계면 `시작하기`를 보인다. 기존 정확한 aria-label (`N단계 잠김`, `N단계 완료, 재플레이 가능`, `N단계 플레이 가능`)과 disabled 상태를 유지하면 기존 테스트 및 사용자의 학습 비용이 낮다. 완료/잠금은 색만 다른 상태가 되지 않게 텍스트를 유지한다.
  5. 지도 제목/안내는 쉬운 모험 말투로 다듬되 중요한 `단계 선택`, 완료/해금 숫자, 20단계 완료 메시지는 유지한다. 부제는 T01 App 헤더에 이미 있으므로 화면에서 중복하지 않는다. 작은 `StickerIcon` 장식을 지도 제목이나 코너에 둔다.
- **Error & Exception Handling**: `stage > progress.unlockedStage`면 `onStartSession` 호출을 막는다. 진행 데이터가 저장소에서 복구되더라도 기존 stageRecords의 최고 기록을 그대로 보여준다. 장식은 스크린 리더·키보드 타깃이 되지 않는다.
- **State Transition & Return**: 잠금 해제/완료 판단 및 `createGameState(stage, generateMaze(getMazeSize(stage)))` 호출은 그대로다. 지그재그는 레이아웃만 바꾼다.

### I02. 탐험가 선택 스티커와 기존 화면 검증

- Related Files:
  - `src/components/Player/PlayerAppearancePicker.module.css` :: `.picker`, 선택/미선택 버튼; modify
  - `src/components/Player/PlayerAppearancePicker.tsx` :: 표시 문구/장식이 필요한 경우만; optional modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: 기존 버튼 접근성/상태 검증 유지, 필요하면 레이아웃 좌표 검증 추가; modify
  - `src/App.test.tsx` :: 변경된 안내 문구를 참조할 경우만 기존 assertion 갱신; optional modify

#### Details

- **Signatures & Types**: `PlayerAppearancePicker`의 기존 `value: PlayerAppearance`, `onChange` props와 `aria-pressed`를 유지한다. `<img>`의 `alt=""`/`aria-hidden="true"`는 장식 취급으로 유지한다.
- **Data & Schema Fields**: 탐험가 선택 저장 key `maze-rescue-game.appearance.v1`은 `App.tsx`에 그대로 남는다. `girl`/`boy` enum 값은 변경하지 않는다.
- **Execution Flow / Logic**:
  1. 2개 선택 버튼을 말랑한 스티커 카드로 조정하고 선택된 버튼은 테두리·배경·시각 마커로 분명히 표시한다. 각 버튼 최소 터치 높이 44px, 모바일 줄바꿈, 키보드 포커스 링을 유지한다.
  2. 단계 카드의 `aria-label`과 `disabled`/focus 동작을 기존 테스트에 맞춰 보존한다. 경로 위치를 검증할 테스트를 추가한다면 첫 행 1→5, 둘째 행 6→10의 반대 방향, 2열 모바일용 변수 산출을 DOM 속성 수준에서 확인한다. CSS 화면 자체는 브라우저 육안으로 확인한다.
  3. campaign Complete 문구와 record 표시는 실제 데이터에 맞춰 유지한다. `20/20` 상태에서 20단계 재플레이 버튼이 여전히 활성화되어야 한다.
- **Error & Exception Handling**: 작은 화면에서 스티커/선이 겹치더라도 클릭 영역을 가리지 않는다. `prefers-reduced-motion`에서는 장식 애니메이션을 끈다.
- **State Transition & Return**: 성별 선택 이벤트와 단계 시작 이벤트는 원래 callback만 호출한다.

## Acceptance Criteria

- [ ] 넓은 화면에서 단계 1~20이 5×4 지그재그, 좁은 화면에서 2열 지그재그 순서로 보이고 길이 끊기지 않는다.
- [ ] Tab 및 스크린 리더 순서는 1→20이며 잠긴 단계는 실행할 수 없다.
- [ ] 최고 기록, 완료/해금 수, 20단계 완료/재플레이 동작이 유지된다.
- [ ] 탐험가 선택은 단계 선택 화면에만 있고 `aria-pressed`, 키보드/터치 조작이 유지된다.
- [ ] 작은 화면에서 버튼·글씨가 잘리지 않고 장식이 클릭을 가리지 않는다.

## Validation

- `npm.cmd test -- --run src/components/Campaign/CampaignScreen.test.tsx src/App.test.tsx` — 단계/탐험가 동작 회귀 확인.
- `npm.cmd run build` — CSS 변수 스타일 타입과 번들 확인.
- 브라우저에서 넓은 화면(약 1200px)과 좁은 화면(약 390px)으로 1→20 길 연결·클릭·Tab 순서 확인.

## Commit Message

```text
fix(maze): 단계 선택을 지그재그 탐험 지도로 변경

Plan: 2026-10-01-cute-game-web-ui
Phase: P01-storybook-ui
Task: T02-campaign-route

- 데스크톱 5열과 모바일 2열 단계 경로 구성
- 단계 상태와 탐험가 선택 스티커 디자인 적용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (캠페인·앱 테스트 11개, 빌드, 1200px·390px·320px 렌더링)
- commit: Git 기록 참조
