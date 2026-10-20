# Task: T02 로그인 관문과 계정 게임 동기화

## Status: done

## Goal

`App`의 게임 렌더링을 올바른 유형의 로그인 뒤로 옮기고, 서버가 발급한 도전에서만 단계 완료를 기록한다. 계정의 해금·최고 시간은 서버 기준으로 동기화하고, 일시정지 미로만 사용자별 브라우저 저장소에 둔다.

## Decision Summary

- 비회원 플레이 금지. `/microsoft`와 `/simple`은 다른 유형의 세션을 게임에 통과시키지 않는다. `/`는 두 주소 선택만 보여준다.
- 기존 전역 `maze-rescue-game.save.v6`는 읽거나 계정에 업로드하지 않는다. 로그인 후 진행은 D1 기준, 일시정지 상태만 계정별 localStorage에 둔다.

## Implementation

### I01. 계정별 기기 저장과 서버 진행 상태

- Related Files:
  - `src/persistence/accountSaveStore.ts` :: `accountSaveKey`, `loadAccountSave`, `saveAccountSave`, `clearAccountSession` — 계정별 로컬 일시정지·미전송 결과; new
  - `src/persistence/accountSaveStore.test.ts` :: scoped save tests — 사용자 교차 오염과 기존 v6 무시; new
  - `src/hooks/usePersistedGame.ts` :: `usePersistedGame`, `ActiveSession`, `recordStageResult`, `refreshProgress` — 서버 진행과 로컬 일시정지로 재구성; modify
  - `src/hooks/usePersistedGame.test.ts` :: hook tests — 서버 기록·로컬 세션·재시도 검증; modify
  - `src/persistence/saveSchema.ts` :: `SavedSession`, `isSaveData` — 기존 v6 상태 검증 helper 재사용; read-only
  - `src/persistence/saveStore.ts` :: `makeSavedSession`, `SAVE_KEY`, `mergeSaveData` — 일시정지 변환만 재사용, 기존 전역 저장·병합은 호출 금지; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface PendingResult { attemptId: string; stage: number; clearTimeSeconds: number }
  interface AccountLocalSave { version: 1; userId: string; currentSession: SavedSession | null; attemptId: string | null; pendingResult: PendingResult | null }
  function accountSaveKey(userId: string): string
  function loadAccountSave(userId: string, progress: ProgressDto): AccountLocalSave
  function saveAccountSave(value: AccountLocalSave): void
  interface ActiveSession { id: number; attemptId: string; state: GameState }
  function usePersistedGame(args: { userId: string; initialProgress: ProgressDto }): { progress: CampaignProgress; session: ActiveSession | null; startSession: (state: GameState, attemptId: string) => void; captureSession: (id: number, state: GameState) => void; recordStageResult: (stage: number, clearTimeSeconds: number, attemptId: string) => Promise<void>; refreshProgress: () => Promise<void>; discardSession: () => void; persistNow: () => void; pendingResult: PendingResult | null; retryPendingResult: () => Promise<void> }
  ```
- **Data & Schema Fields**: localStorage key는 `maze-rescue-game.account.<encoded userId>.session.v1`. 값은 위 `AccountLocalSave`뿐이며 `stageRecords`·`unlockedStage`를 별도 진실 원천으로 저장하지 않는다. `SavedSession`은 기존 paused 상태 모델이다. `attemptId`는 해당 paused 미로에만 붙는다. `pendingResult`는 서버 완료 응답을 받기 전까지 남는다.
- **Execution Flow / Logic**:
  1. 로컬 저장을 읽을 때 키·`userId`·version·paused `SavedSession`·attemptId 형태를 확인한다. `isSaveData`에 서버 `progress`를 넣은 합성 객체로 기존 복잡한 미로 검증을 재사용한다. 잠긴 단계이거나 malformed 세션은 버린다. 기존 전역 `SAVE_KEY`와 v4/v5/v6 migration 경로는 호출하지도 삭제하지도 않는다.
  2. `progress`는 로그인 시 `SessionDto.progress`로 시작하며, `refreshProgress`는 `getSession()`의 서버 진행으로 교체한다. 로컬·서버 stageRecords를 `mergeSaveData`로 합치지 않는다. 다른 기기에서 생긴 해금·최고 기록은 재조회 시 반영된다.
  3. 클리어 시 `pendingResult`를 먼저 계정별 저장소에 기록하고 `finishRun`을 호출한다. 성공 응답의 `progress`로 화면을 갱신하고 pending을 지운다. 네트워크 실패면 pending을 유지하고 재시도 UI를 제공한다. 응답 분실 후 재시도 409면 `getSession()`을 읽어 해당 stage의 서버 최고 시간이 보고 시간 이하인 경우만 성공 처리한다. 아니면 오류를 유지한다.
  4. 일시정지·pagehide에서는 `makeSavedSession`으로 현재 미로와 attemptId만 계정별 저장한다. won/lost 세션은 저장하지 않는다. 재로그인한 같은 계정만 해당 paused 미로를 읽고 다른 계정·다른 기기에서는 읽지 않는다. 로그아웃 때 메모리 게임은 지우되 기존 계정 로컬 세션은 보존한다.

### I02. App 관문과 서버 도전 시작

- Related Files:
  - `src/App.tsx` :: `App`, `AuthenticatedGame`, `startStage`, `handleSessionChange` — 경로·세션 확인 후 게임 렌더링; modify
  - `src/App.test.tsx` :: App tests — 비로그인·다른 유형·계정별 저장·기존 v6 무시; modify
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreen`, `startStage` — stage 번호를 부모의 async 도전 시작에 전달; modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: campaign tests — 비동기 시작·잠긴 단계; modify

#### Details

- **Signatures & Types**:
  ```typescript
  function AuthenticatedGame(props: { session: SessionDto }): ReactElement
  interface CampaignScreenProps { progress: CampaignProgress; appearance: PlayerAppearance; onAppearanceChange: (appearance: PlayerAppearance) => void; onStartStage: (stage: number) => Promise<void> }
  async function startStage(stage: number, maze?: Maze): Promise<void>
  ```
- **Execution Flow / Logic**:
  1. `getAuthRoute(location.pathname)`가 null이면 `RouteChoice`만, 유효 경로라도 `useAuthSession`이 loading/error/anonymous면 각각 로딩·재시도·해당 `LoginScreen`만 렌더링한다. 같은 Cookie가 다른 경로의 `authType`이면 불일치 안내와 로그아웃만 보여주고 게임·랭킹은 숨긴다.
  2. 인증된 게임에서 단계 버튼을 누르면 `startRun(stage)` 성공 후에만 `createGameState(stage, maze ?? generateMaze(getMazeSize(stage)))`와 `startSession(state,attemptId)`를 호출한다. 실패하면 단계 선택 화면을 유지하고 오류·재시도 UI를 보여준다.
  3. 다음 단계도 서버가 갱신한 `progress.unlockedStage`에서만 열리고 서버가 발급한 새 attempt를 요구한다. appearance 선택은 기존 기기 로컬 키를 유지하되 계정 진행 데이터와 혼동하지 않는다.
  4. 기존 `App.test.tsx`의 `loadSave()`를 직접 읽는 기대는 새 `accountSaveStore` 기준으로 옮긴다. 기존 `saveStore.test.ts`는 호환 유틸리티 테스트로 남겨 두되 App에서는 기존 로컬 데이터를 가져오지 않는 테스트를 추가한다.

### I03. 재도전·클리어 제출의 UI 수명주기

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: `GameScreenProps`, win effect, retry handlers — 새 attempt 요청과 저장 상태; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: result tests — 완료 저장 중·실패·재시도·새 attempt; modify
  - `src/components/Overlays/ResultOverlay.tsx` :: `ResultOverlayProps`, `ResultOverlay` — 저장 중/실패/완료 문구와 재시도; modify
  - `src/components/Overlays/Overlays.module.css` :: result status styles — 접근 가능한 오류·로딩 표시; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface GameScreenProps {
    initialState: GameState
    attemptId: string
    onStageComplete: (stage: number, clearTimeSeconds: number, attemptId: string) => Promise<void>
    onRetryStage: (stage: number, maze?: Maze) => Promise<void>
    onNextStage: (stage: number) => Promise<void>
    // 기존 appearance, onCampaign, onStateChange, onPersistNow, onDiscardSession도 유지
  }
  type RecordStatus = 'saving' | 'saved' | 'error'
  ```
- **Execution Flow / Logic**:
  1. 현재 `GameScreen`의 `reportedWin` effect가 `state.status==='won'` 때 `onStageComplete(stage, time, attemptId)`를 한 번 호출한다. 완료 응답 전에는 결과 화면을 `saving`, 성공 후 `saved`, 실패 시 `error`로 표시하고 `error`에서 같은 attempt 결과 재전송 버튼을 제공한다. 완료되지 않은 기록으로 다음 단계를 열지 않는다.
  2. 기존 `RETRY_SAME_MAZE`, `RESTART_NEW_MAZE`를 컴포넌트 내부에서 즉시 dispatch하지 않는다. 결과 화면에서 `onRetryStage(stage,state.maze)` 또는 `onRetryStage(stage)`를 await하고, 서버 start 성공 후 App이 새 key의 `GameScreen`을 마운트한다. 실패하면 기존 결과 화면과 오류를 유지한다. 같은 미로 재도전은 기존 Maze 객체를 전달한다.
  3. 진행 중 미로는 페이지 숨김 시 기존 `usePageVisibilityPause`를 그대로 써서 paused 상태를 저장한다. `ResultOverlay`의 저장 상태는 `role="status"`, 실패는 `role="alert"`로 알리고 비동기 중복 클릭을 막는다.
  4. 서버 기록 완료가 실패한 상태에서 캠페인 화면으로 돌아가더라도 `pendingResult`는 사라지지 않는다. 캠페인에서 재전송/새로고침 복구를 제공한다. 같은 attempt의 409와 서버 반영 여부는 I01의 재조회 규칙으로 처리한다.

## Acceptance Criteria

- [x] 비로그인·잘못된 유형 세션·API 실패에서 게임 플레이 UI가 열리지 않는다.
- [x] 신규 계정은 기존 전역 localStorage의 해금·최고 기록을 받지 않고 1단계에서 시작한다.
- [x] 모든 시작·재도전은 서버 attempt를 발급받고, 클리어 성공 뒤에만 서버 진행·랭킹 후보가 갱신된다.
- [x] 다른 기기에서 해금·최고 시간은 동기화되고 일시정지 중 미로는 기기·계정별로 격리된다.
- [x] 결과 제출 네트워크 오류와 응답 분실 후 재시도를 처리하며 기록을 조용히 잃지 않는다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/hooks/usePersistedGame.test.ts src/persistence/accountSaveStore.test.ts src/components/Campaign/CampaignScreen.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 관문·게임·저장·재시도 통과
- `npm.cmd test -- --run` — 기존 20단계 게임 회귀 확인
- `npm.cmd run lint` — 앱·Worker 타입 검사 통과
- `npm.cmd run build` — 프로덕션 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(game): 로그인 계정 도전과 진행 동기화

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P02-game-client
Task: T02-account-game-sync

- 로그인 경로와 계정 유형에 맞을 때만 게임 제공
- 계정별 일시정지 상태 저장과 서버 단계 기록 연동
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `0bba5e1`
