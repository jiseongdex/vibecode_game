# Task: T03 자동 시작 안내와 재도전 카운트다운

## Status: done

## Goal

단계 선택/다음 단계 진입 시 미로 틀 안의 흐린 미로 위에 안내 문구 약 3초와 `3 → 2 → 1`을 보여주고 자동 시작한다. 같은/새 미로 재도전은 안내 문구 없이 숫자만 보여준다.

## Decision Summary

- 게임 페이지의 별도 `시작하기` 버튼은 제거한다. 단계 선택 카드 안의 `시작하기` 표시는 유지한다.
- 시작 효과는 화면 로컬 상태이며 `GameState`/저장 스키마에는 넣지 않는다. `START`는 카운트다운 마지막에만 dispatch하므로 입력과 게임 타이머가 그전에는 진행되지 않는다.

## Implementation

### I01. 진입 경로별 시작 시퀀스와 타이머

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, 새 `IntroStep` 상태와 타이머 effect, 결과 버튼 콜백 — 자동 시작 경로; modify
  - `src/game/gameState.ts` :: `GameStatus`, `START`, `RETRY_SAME_MAZE`, `RESTART_NEW_MAZE` — 현재 상태 전이 계약; read-only
  - `src/hooks/usePageVisibilityPause.ts` :: 기존 플레이 중 숨김 일시 정지; read-only
  - `src/App.tsx` :: `GameScreen key={session.id}`와 새 단계 세션 생성; read-only
  - `src/components/Campaign/CampaignScreen.tsx` :: 단계 카드의 `시작하기` 표시는 유지; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  type IntroStep = 'message' | 3 | 2 | 1 | null
  // GameScreen initialState?: GameState
  // GameAction: { type: 'START'; now: number }
  //           | { type: 'RETRY_SAME_MAZE' }
  //           | { type: 'RESTART_NEW_MAZE'; maze: Maze }
  ```
- **Data & Schema Fields**: `GameState.status: 'ready' | 'playing' | 'paused' | 'won' | 'lost'`, `startedAt: number | null`, `remainingSeconds: number`는 기존 필드다. `IntroStep`과 페이지 표시 여부는 `GameScreen`의 로컬 상태이며 저장하지 않는다. 새 세션은 `ready`, 복원 세션은 `paused`로 들어온다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `useReducer`로 만든 최초 상태가 `ready`이면 `IntroStep='message'`로 초기화한다. `paused/won/lost/playing`으로 마운트된 상태는 `null`로 시작해 안내를 띄우지 않는다. `App`은 세션 ID를 key로 쓰므로 다음 단계 진입은 새 컴포넌트에서 `message`부터 시작한다.
  2. Core Processing: `state.status==='ready'`이고 페이지가 보일 때만 `window.setTimeout`을 하나 등록한다. `message`는 3000ms 뒤 `3`, 숫자 단계는 각각 1000ms 뒤 `3→2→1` 순서로 진행한다. `1`의 1000ms가 끝날 때 `dispatch({type:'START', now:Date.now()})`하고 `IntroStep=null`로 둔다. effect cleanup에서 timeout을 해제해 rerender/unmount/StrictMode에서 중복 시작하지 않게 한다.
  3. Retry Processing: 기존 `onRetrySameMaze`와 `onRestartNewMaze` 콜백에서 해당 reducer action을 dispatch하고 `IntroStep=3`으로 설정한다. 새 미로는 기존 `generateMaze(state.stageConfig.size)`를 그대로 쓴다. 결과 오버레이가 사라지면 바로 숫자 `3`이 보이고 약 3초 뒤 시작한다. 결과 화면의 `다음 단계`는 `App.startStage`로 새 세션이므로 전체 문구+숫자 흐름을 사용한다.
  4. Visibility & Error Handling: 문서가 숨겨진 동안 intro timeout을 진행하지 않는다. `visibilitychange`로 표시 여부를 갱신하고 숨김 시 타이머를 정리하며 돌아오면 현재 단계의 시간을 다시 센다. 숨김 상태에서 `START`를 dispatch하지 않는다. 이미 `playing` 상태의 숨김 일시 정지는 기존 `usePageVisibilityPause`에 맡긴다.
  5. State Transition & Return: `playing`이 되기 전에는 `useKeyboardMovement.enabled=false`, `DirectionControls.disabled=true`, `GameHud.canPause=false`, 1초 `TICK` interval 미설정 상태를 유지한다. 저장 중 intro를 떠난 경우 기존 `makeSavedSession`이 `ready`를 `paused`로 저장하므로 복원 화면은 기존 일시 정지 dialog를 보여준다.

### I02. 미로 틀 내부 오버레이와 안내 문구

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `.playfield`의 `MazeBoard` 뒤에 `IntroStep` 오버레이 렌더링, 기존 시작 버튼/불필요한 `StickerIcon` import 제거; modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.introOverlay`, `.introMessage`, `.introNumber`, 기존 `.actions` 제거 — 미로 내부 가림막; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard` 1240×840 내용과 5px 테두리 스케일 확인; read-only
  - `src/styles/tokens.css` :: T02의 `--font-message`; read-only

#### Details

- **Signatures & Types**: `IntroStep`이 `'message'`면 정확히 `동물을 구출해서 탈출해줘!`, 숫자면 해당 숫자를 텍스트로 렌더링한다. 오버레이에는 `role='status'`와 `aria-live='polite'`를 사용한다.
- **Data & Schema Fields**: `BASE_FRAME_WIDTH=1250`, `BASE_FRAME_HEIGHT=850`, `sceneScale: number`를 유지한다. `MazeBoard`는 내용 1240×840과 `5 * sceneScale` 테두리를 가진다.
- **Execution Flow / Logic**:
  1. `.playfield`의 기존 너비/높이/스케일 구조를 유지하고 오버레이를 `MazeBoard` 뒤에 절대 배치한다. 오버레이 안쪽 여백은 `5 * sceneScale` px를 CSS 변수(예: `--frame-border`)로 전달해 **테두리는 그대로 보이고 미로 내부만** 반투명 색으로 덮는다. `z-index`를 미로/미니맵 위, 일시 정지/결과 overlay 아래에 둔다.
  2. `.introMessage`와 `.introNumber`에 `font-family: var(--font-message)`를 적용한다. 밝은 글씨와 충분한 명도 대비, 가운데 정렬 및 줄바꿈을 사용한다. 모바일 320px와 낮은 가로 화면에서 문구가 잘리지 않게 `clamp()` 크기와 패딩을 조정한다. `prefers-reduced-motion`은 시각 애니메이션만 제거하고 타이밍과 자동 시작은 유지한다.
  3. `controlsArea`와 ref는 화면 높이 측정에 필요하므로 유지한다. 게임 화면 하단의 `시작하기` 버튼과 비게 되는 `.actions` 마크업/스타일만 제거한다. 단계 선택 카드의 텍스트는 바꾸지 않는다.
  4. 오버레이를 클릭해 건너뛰는 기능은 만들지 않는다. 입력은 `ready` 상태의 reducer와 disabled 조작 버튼으로 차단한다.

### I03. 경로·시간·복원 테스트

- Related Files:
  - `src/components/GameScreen/GameScreen.test.tsx` :: 기존 시작 버튼/재도전 기대값 갱신, 가짜 시계로 시간 경계 검증; modify
  - `src/App.test.tsx` :: 단계 진입/저장 복원/숨김 테스트의 시작 버튼 조작을 카운트다운 진행으로 변경; modify
  - `src/game/integration.test.tsx` :: UI를 통한 단계 선택→시작→저장 복원 시나리오 갱신; modify
  - `src/components/Hud/GameHud.test.tsx` :: T02 버튼 이름 기대값; read-only

#### Details

- **Signatures & Types**: `vi.useFakeTimers()`, `act(() => vi.advanceTimersByTime(ms))`로 DOM과 `onStateChange`를 검증한다. 테스트 종료 때 `vi.useRealTimers()`를 복구한다.
- **Data & Schema Fields**: `remainingSeconds`와 `startedAt`은 전체 6000ms intro 동안 변하지 않고 종료 시 `playing`/현재 시각으로 바뀐다. 재도전은 3000ms만 대기한다.
- **Execution Flow / Logic**:
  1. 단계 진입 직후 시작 버튼이 없고 미로는 보이며 안내 문구가 보인다. 2999ms까지 문구, 3000ms에 `3`, 이후 1000ms마다 `2`, `1`을 표시한다. 총 6000ms 뒤 숫자가 사라지고 조작/쉬기 버튼이 활성화된다. 첫 게임 `TICK`은 그다음 1000ms 후에만 발생한다. 시작 전 방향키·방향 버튼 입력은 플레이어를 움직이지 않는다.
  2. `lost/won` 결과에서 같은 미로와 새 미로 버튼을 각각 눌러 문구 없이 `3`부터 시작하는지, 3000ms 후에 플레이하는지, 같은 미로는 T01의 동물 ID를 유지하는지 확인한다. `다음 단계`는 새 세션 전체 intro를 검증한다.
  3. 중간에 문서를 숨겼다 돌아올 때 숫자 타이머가 숨김 동안 진행되지 않고, 숨겨진 채 게임이 시작되지 않는지 검증한다. 복원된 `paused` 게임은 intro 없이 기존 dialog를 유지하고 `이어하기` 후 재개한다.
  4. 현재 테스트의 게임 화면 `시작하기` 버튼 검색은 intro 시간 경계 검증으로 바꾼다. `CampaignScreen` 단계 카드의 `시작하기` 텍스트는 유지한다.

## Acceptance Criteria

- [x] 단계 선택과 다음 단계 진입은 약 3초 문구 + 3초 숫자 후 자동 시작한다.
- [x] 같은/새 미로 재도전은 문구 없이 3초 숫자 후 자동 시작한다.
- [x] 시작 전 이동·시간이 진행되지 않고, 숨김 탭이나 복원된 일시 정지 게임이 자동으로 플레이되지 않는다.
- [x] 반투명 오버레이는 미로 틀 내부에만 배치된다.
- [x] 게임 화면 시작 버튼은 없어지고 단계 선택 카드의 시작 표시는 유지된다.

## Validation

- `npm.cmd test -- --run src/components/GameScreen/GameScreen.test.tsx src/App.test.tsx src/game/integration.test.tsx` — 단계 진입·재도전·저장·숨김 흐름 통과.
- `npm.cmd test -- --run` — 게임 상태, 보드, HUD 등 전체 회귀 통과.
- `npm.cmd run build` — 타입/번들 통과.
- 브라우저에서 데스크톱, 390×844 모바일, 낮은 가로 화면으로 진입/재도전/복원 시 문구 가림 범위와 타이밍을 확인한다.

## Commit Message

```text
feat(game): 안내 카운트다운 뒤 미로 자동 시작

Plan: 2026-10-02-random-animal-cute-game-intro
Phase: P01-game-entry
Task: T03-automatic-intro-and-retry-countdown

- 단계 진입은 안내 문구와 카운트다운 후 자동 시작
- 재도전은 숫자만 표시하고 저장 복원은 일시 정지 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 대상 22개, 전체 125개, 빌드 통과. 브라우저 연결 부재로 수동 시각 확인은 미실시.
- [ ] 작은 화면 브라우저 육안 확인 (이번 환경에 연결된 브라우저가 없어 수행 불가)
- commit: Git 기록 참조
