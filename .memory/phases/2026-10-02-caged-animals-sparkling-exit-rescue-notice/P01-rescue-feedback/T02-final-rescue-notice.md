# Task: T02 마지막 구출 후 1.5초 알림

## Status: done

## Goal

플레이 도중 마지막 동물 구출 직후 미로 위쪽 중앙에 `동물 구출 완료! 탈출구를 찾자`를 1500ms 표시하고, 알림 중에도 게임 이동·시간을 계속 진행한다.

## Decision Summary

- 알림은 한 마리씩 구출할 때마다가 아니라 **미구출 대상이 0이 되는 전이**에서만 한 번 발생한다.
- 알림은 게임 상태·저장 스키마에 넣지 않는 로컬 UI 상태다. 일시 정지·승리·패배·재도전·언마운트 시 정리하며 복원 시 재생하지 않는다.

## Implementation

### I01. 마지막 구출 전이와 타이머

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreen`, `rescuedCount`, 새 로컬 notice 상태·effects — 마지막 구출 감지와 1500ms 정리; modify
  - `src/game/gameState.ts` :: `GameState.rescues`, `gameReducer(MOVE)` — 구출 플래그 전이 계약; read-only
  - `src/hooks/usePageVisibilityPause.ts` :: 숨김 탭 자동 일시 정지 — 기존 정리와 연계; read-only
  - `src/persistence/saveStore.ts` :: 준비·플레이 상태의 일시 정지 저장 — 알림 저장 안 함; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  // 기존 GameState.rescues: RescueTarget[]
  // RescueTarget.rescued: boolean
  const rescuedCount: number = state.rescues.filter((target) => target.rescued).length
  const previousRescuedCount = useRef<number>(rescuedCount)
  const [showRescueNotice, setShowRescueNotice] = useState(false)
  ```
- **Data & Schema Fields**: 새 영구 데이터 필드는 없다. 로컬 `showRescueNotice: boolean` 기본값 `false`; `previousRescuedCount: RefObject<number>` 초기값은 **마운트 당시 구출 수**다. 이 초기화로 이미 전원 구출된 저장 게임 복원에서 과거 알림이 뜨지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `rescuedCount`를 `GameScreen`의 기존 계산에서 한 번만 사용하고, 새 ref는 그 값으로 초기화한다. `state.stageConfig.rescueCount`는 1~5다. `state.status`가 `playing`일 때만 새 알림을 시작한다.
  2. Core Processing: 상태 변경 effect에서 `previousRescuedCount.current < state.stageConfig.rescueCount && rescuedCount === state.stageConfig.rescueCount`를 검사해 마지막 구출로 처음 전환된 경우 `showRescueNotice=true`로 둔다. 매 effect 끝에 ref를 현재 구출 수로 갱신한다. 중간 구출, TICK, 방향 전환, 부모 rerender에서 다시 띄우지 않는다.
  3. Timer: 별도 effect에서 notice가 true일 때 `window.setTimeout(() => setShowRescueNotice(false), 1500)` 하나를 등록하고 cleanup에서 `clearTimeout`한다. 타이머가 실행 중이어도 `useKeyboardMovement`, `DirectionControls`, 1초 `TICK` interval은 기존 `playing` 기준 그대로다.
  4. State Handling: `state.status !== 'playing'`이면 notice를 즉시 false로 둔다. 일시 정지·승리·패배·재도전의 이전 타이머가 남지 않으며 언마운트 cleanup도 작동한다. 복원된 `paused` 상태와 최초 마운트 시 이미 모두 구출된 `playing` 상태는 notice를 띄우지 않는다.
  5. Error Handling: 다중 동물 단계에서 이미 일부 구출된 상태에서 마지막 하나를 구출하면 정상 표시한다. 다른 게임 세션은 `App`의 `GameScreen key={session.id}`로 새 컴포넌트가 되므로 이전 ref와 타이머가 넘어오지 않는다. reducer 또는 저장 스키마를 바꾸지 않는다.

### I02. 미로 위쪽 중앙의 비차단 표시

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `.playfield` 안의 알림 JSX — `MazeBoard` 뒤, pause/result 전에 렌더링; modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.rescueNotice` — 위쪽 중앙 위치, 작은 글씨, 높은 대비; modify
  - `src/components/Overlays/Overlays.module.css` :: 결과·일시 정지 overlay `z-index: 10`; read-only
  - `src/styles/tokens.css` :: `--font-message` (Jua); read-only

#### Details

- **Signatures & Types**: `showRescueNotice && state.status === 'playing'`일 때만 `role="status" aria-live="polite" data-testid="rescue-notice"` 요소를 렌더링한다. 텍스트는 정확히 `동물 구출 완료! 탈출구를 찾자`다.
- **Data & Schema Fields**: `.playfield`는 기존 `BASE_FRAME_WIDTH=1250`, `BASE_FRAME_HEIGHT=850`, `--frame-border = 5 * sceneScale`를 가진 상대 위치 컨테이너다.
- **Execution Flow / Logic**:
  1. `position:absolute; top:calc(var(--frame-border) + 12px); left:50%; transform:translateX(-50%)`로 미로 틀 **안쪽 위 중앙**에 둔다. `z-index:6`은 미로/인트로보다 높고 pause/result의 10보다 낮다.
  2. `max-width:calc(100% - 24px)`, `font-family:var(--font-message)`, `font-size:clamp(16px, 2.4vw, 25px)`, 둥근 밝은 배경·진한 글씨·패딩으로 작은 화면에서도 읽히게 한다. `pointer-events:none`이며 전체 화면 가림막을 추가하지 않는다.
  3. 문서가 숨겨지면 기존 visibility hook이 `playing`을 `paused`로 바꾸므로 notice는 사라진다. 접근성 상태는 한 번만 읽히게 DOM 표시 기간만 1500ms로 유지한다.

### I03. 시간 경계와 복원 검증

- Related Files:
  - `src/components/GameScreen/GameScreen.test.tsx` :: `GameScreen` — 마지막 구출, 중간 구출, 1499/1500ms, 비차단, 일시 정지·복원 테스트; modify
  - `src/game/integration.test.tsx` :: 기존 구출·탈출 게임 경로; read-only

#### Details

- 테스트의 `createGameState(1, generateMaze(...))`는 구출 대상 1마리, 5단계는 2마리다 (`getRescueCount(stage) = floor((stage-1)/4)+1`). 목표 동물의 상하좌우 중 `isWalkableGridPosition`인 인접 칸을 찾아 `player`를 둔 `status:'playing'` 상태로 `GameScreen`을 렌더링하고 해당 방향 키를 눌러 실제 `MOVE`를 발생시킨다. 5단계에서는 처음 한 마리 구출 때 알림 없음, 나머지를 마지막으로 구출할 때 한 번 표시를 확인한다.
- `vi.useFakeTimers()`와 `act(() => vi.advanceTimersByTime(...))`로 1499ms까지 표시, 1500ms에 제거를 확인한다. 1000ms 게임 `TICK`은 notice 중에도 감소하고 이동 버튼은 활성화되어 있어야 한다. 일시 정지 직후 제거, 이미 모두 구출된 초기/복원 상태에서는 미표시, 언마운트 타이머 cleanup을 검증한다.
- 게임 화면의 기존 intro(`ready` 때 3초+카운트다운)와 결과 overlay는 그대로 작동해야 한다.

## Acceptance Criteria

- [x] 마지막 동물 구출에서만 정확한 문구를 약 1.5초 표시한다.
- [x] 알림은 미로 위쪽 중앙의 작은 비차단 표시이고 이동·시간은 계속된다.
- [x] 저장 복원·일시 정지·승리·패배·재도전 때 과거 알림이 남지 않는다.
- [x] 새 저장 필드 없이 기존 intro·결과 화면을 유지한다.

## Validation

- `npm.cmd test -- --run src/components/GameScreen/GameScreen.test.tsx src/game/integration.test.tsx` — 구출 전이·1.5초·비차단·복원 경로 통과.
- `npm.cmd test -- --run` — 전체 회귀 통과.
- `npm.cmd run build` — 타입 검사와 번들 통과.
- 브라우저 연결 시 데스크톱·390×844 모바일·낮은 가로 화면에서 notice의 위치와 게임 지속 확인; 연결되지 않으면 미실시 기록.

## Commit Message

```text
feat(game): 마지막 동물 구출 알림 표시

Plan: 2026-10-02-caged-animals-sparkling-exit-rescue-notice
Phase: P01-rescue-feedback
Task: T02-final-rescue-notice

- 마지막 구출 때 1.5초 비차단 안내 표시
- 일시 정지와 저장 복원에서 알림 상태 정리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
