# 작업: T01 시간 기록만 유지하고 새 세이브 형식 적용

## 상태: 완료

## 목표
`moveCount`를 게임 상태, HUD, 결과 화면, 캠페인 기록, 세이브 데이터에서 제거한다. 스테이지별 기록에는 최고 클리어 시간만 남긴다. 저장 형식을 v3로 변경하되 개발 단계이므로 v1·v2 로컬 세이브는 마이그레이션하거나 복원하지 않는다.

## 결정 요약
- `moveCount`는 HUD·결과 화면 표시, 게임 상태·세이브 검증, 최고 이동 횟수 기록 및 애니메이션에 쓰인다. 이를 모두 제거하고 애니메이션은 렌더 전용 임시 입력 신호를 사용한다.
- 새 `StageRecord`에는 `bestTimeSeconds`만 둔다.
- 저장 버전과 키를 v3로 변경한다. 로드는 v3 키만 확인한다. 구형 v1·v2 데이터는 변환하지 않으며, 유효한 v3가 없으면 빈 진행도로 시작한다.

## 구현

### I01. 게임 상태·화면·진행 기록에서 이동 횟수 제거
- 관련 파일:
  - `src/game/gameState.ts` :: `GameState`, `createGameState`, `gameReducer`; 수정
  - `src/game/campaignProgress.ts` :: `StageRecord`, `completeStage`; 수정
  - `src/components/GameScreen/GameScreen.tsx` :: props, 승리 처리, HUD·결과 화면 연결; 수정
  - `src/components/Hud/GameHud.tsx` :: `GameHudProps`, 이동 횟수 표시; 수정
  - `src/components/Campaign/CampaignScreen.tsx` :: 스테이지 최고 기록 표시; 수정
  - `src/components/Overlays/ResultOverlay.tsx` :: `ResultOverlayProps`, 클리어 결과 문구; 수정
  - `src/components/MazeBoard/MazeBoard.tsx` :: 이동 횟수를 대체하는 렌더 전용 `movementAttempt` 신호 연결; 수정
  - `src/components/Player/PlayerSprite.tsx`, `src/components/Rescue/RescueSprite.tsx` :: `movementAttempt`를 걷기 애니메이션 신호로 사용; 수정
  - `src/hooks/usePersistedGame.ts` :: `recordStageResult`; 수정
  - `src/App.tsx` :: 세션 완료 콜백 연결; 필요 시 시그니처 수정
  - `src/game/gameState.test.ts`, `src/game/integration.test.tsx`, `src/components/GameScreen/GameScreen.test.tsx`, `src/components/Hud/GameHud.test.tsx`, `src/components/Campaign/CampaignScreen.test.tsx`, `src/components/MazeBoard/MazeBoard.test.tsx`, `src/App.test.tsx`; 수정
  - `src/game/campaignProgress.test.ts` :: 시간만 기록하는 `completeStage`; 새 파일
- **정확한 타입과 동작**:
  - `GameState`에서 `moveCount: number`를 삭제한다. `createGameState`에서 초기화하지 않고 `gameReducer`의 성공 이동 반환값에서도 증가시키지 않는다. 벽 판정, 한 번에 한 칸 이동, 구조·동행 동물 이동은 유지한다.
  - `StageRecord`를 `{ bestTimeSeconds: number }`로 정의한다.
  - `completeStage(progress: CampaignProgress, stage: number, clearTimeSeconds: number): CampaignProgress`로 변경한다. 스테이지 범위, 해금 여부, 정수·0 이상 클리어 시간 검증을 유지한다. 기존 최고 시간과 새 시간을 비교해 최솟값만 기록한다.
  - `GameScreenProps.onStageComplete`를 `(stage: number, clearTimeSeconds: number) => void`로 변경하고 승리 시 이 두 값만 전달한다.
  - `GameHudProps`와 `ResultOverlayProps`에서 `moveCount`를 제거한다. HUD의 이동 횟수 항목을 없애고 승리 문구는 `클리어 시간 {formatTime(clearTimeSeconds)}`만 표시한다.
  - `usePersistedGame.recordStageResult(stage, clearTimeSeconds)` 및 `completeStage` 호출에서 이동 수 인자를 제거한다.
  - 모든 호출부·테스트 fixture·기대값에서 이동 수 필드와 표시를 제거한다. 애니메이션 신호는 T02·T03의 렌더 전용 상태로 제공하고 `GameState`에 다시 추가하지 않는다.

### I02. 마이그레이션 없이 v3 세이브만 사용
- 관련 파일:
  - `src/persistence/saveSchema.ts` :: 저장 타입, 버전 상수, 검증 함수; 수정
  - `src/persistence/saveStore.ts` :: 읽기·쓰기·병합·삭제; 수정
  - `src/persistence/saveStore.test.ts` :: v3 저장·읽기·병합 테스트; 수정
  - `src/persistence/saveSchema.test.ts` :: v3 검증과 구형 데이터 미복원 테스트; 새 파일
  - `src/hooks/usePersistedGame.test.ts`, `src/App.test.tsx`, `src/game/integration.test.tsx`; 세션·기록 기대값 수정
- **데이터와 스키마**:
  - 최신 `SAVE_VERSION = 3`; `SAVE_KEY = 'maze-rescue-game.save.v3'`.
  - `SaveData.stageRecords` 타입은 `Record<number, StageRecord>`이며 `StageRecord`에는 `bestTimeSeconds: number`만 존재한다.
  - 저장 세션의 `state`는 `GameState & { status: 'paused' }`다. `GameState`에 `moveCount`가 없으므로 세션에도 해당 필드를 두지 않는다.
  - `SaveDataV1`, `SaveDataV2`, `SavedSessionV1`, `SavedSessionV2`, `LEGACY_SAVE_KEY`, 버전별 변환 함수는 새 코드에서 유지하지 않는다.
- **실행 흐름과 로직**:
  1. `SAVE_VERSION`과 `SAVE_KEY`를 v3로 설정한다. `loadSave`는 v3 키만 읽고 `isSaveData`로 검증한다.
  2. v3 키에 유효한 저장 데이터가 있으면 반환한다. 키가 없거나 데이터가 유효하지 않으면 `createEmptySave()`를 반환한다. v1·v2 키를 읽거나 변환하지 않는다.
  3. `isSaveData`는 버전 3, 스테이지별 0 이상의 정수 `bestTimeSeconds`, 기존 규칙에 맞는 현재 세션을 검증한다. `moveCount` 또는 `bestMoveCount`를 요구하지 않는다.
  4. `saveSave`와 `mergeSaveData`는 v3 형식만 처리한다. 병합할 때 스테이지별 `bestTimeSeconds`의 최솟값만 남긴다.
  5. `clearSave`는 현재 v3 저장을 삭제한다. 기존 v1·v2 키가 남아 있어도 앱에서 읽거나 복원하지 않는다.
- **테스트**:
  - `moveCount`와 `bestMoveCount` 없이 v3 데이터가 검증·저장·로드되는지 확인한다.
  - v3 진행도 병합 시 각 스테이지의 최고 시간이 최솟값으로 남고 이동 횟수 필드가 만들어지지 않는지 확인한다.
  - v1·v2 데이터만 있는 경우 마이그레이션하지 않고 빈 v3 세이브로 시작하는지 확인한다.
  - 잘못된 v3 데이터의 빈 세이브 대체, 현재 세션 저장·복구 테스트를 유지한다.

## 완료 기준
- [ ] 앱 런타임 `GameState`, `StageRecord`, 완료 콜백에서 `moveCount`가 제거된다.
- [ ] HUD와 승리 결과 화면에는 이동 횟수 없이 클리어 시간만 표시된다.
- [ ] 진행 기록에는 스테이지별 `bestTimeSeconds`만 저장되고 더 빠른 시간이 기존 기록을 갱신한다.
- [ ] 새 저장 형식은 v3이며 v1·v2 세이브 마이그레이션 코드가 없다.
- [ ] v1·v2 저장만 존재하면 이를 복원하지 않고 빈 진행도로 시작한다.

## 검증
- `npm test -- --run src/game/gameState.test.ts src/game/integration.test.tsx src/game/campaignProgress.test.ts src/persistence/saveSchema.test.ts src/persistence/saveStore.test.ts src/hooks/usePersistedGame.test.ts src/components/GameScreen/GameScreen.test.tsx src/components/Hud/GameHud.test.tsx src/components/Campaign/CampaignScreen.test.tsx src/components/MazeBoard/MazeBoard.test.tsx src/App.test.tsx` — 지정한 테스트 모두 통과
- `npm run lint` — TypeScript 빌드 통과

## 커밋 메시지
```text
feat(progress): 이동 횟수를 제거하고 클리어 시간만 기록

Plan: 2026-09-30-smooth-single-cell-movement
Phase: P01-smooth-movement
Task: T01-time-only-records-and-save-v3

- 게임 상태와 화면에서 이동 횟수 제거
- 진행 기록을 클리어 시간만 남기도록 변경
- 이전 세이브 마이그레이션 없이 새 v3 저장 형식 사용
```

## 진행 상태
- [x] 구현 완료
- [x] 검증 통과
- 커밋: 대기
