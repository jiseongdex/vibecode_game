# Task: T07 진행 저장과 자동 일시정지

## Status: done

## Goal
현재 플레이 상태와 완료 기록을 버전 관리형 `localStorage`에 안전하게 저장하고, 새로고침·탭 전환·브라우저 재실행 후 일시정지 상태로 이어할 수 있게 한다.

## Decision Summary
- 저장 데이터에는 현재 단계, 생성된 미로, 위치, 구출 상태, 이동 횟수, 타이머 상태와 최고 기록을 포함한다.
- 추후 Microsoft 계정 연동 시 해금 단계는 높은 값, 단계 기록은 더 좋은 값으로 병합한다.

## Implementation

### I01. 저장 스키마와 저장소 어댑터
- Related Files:
  - `src/persistence/saveSchema.ts` :: `SAVE_VERSION`, `SaveData`, `StageRecord`, `SavedSession`; new
  - `src/persistence/saveStore.ts` :: `loadSave`, `saveSave`, `clearSave`, `mergeSaveData`; new
  - `src/persistence/saveStore.test.ts` :: 직렬화/복원/병합 테스트; new

#### Details
- `SaveData`는 `{ version: 1; unlockedStage: number; currentSession: SavedSession | null; stageRecords: Record<number, StageRecord> }`다.
- `SavedSession`은 reducer 상태를 JSON 직렬화 가능한 값으로 보유하고 `status`는 저장 시 `paused`로 정규화한다.
- localStorage key는 `maze-rescue-game.save.v1`로 고정한다.
- JSON 파싱 실패, 누락 필드, 잘못된 stage/size는 저장 데이터 전체를 무시하고 초기값으로 복구한다.
- `mergeSaveData(local, remote)`는 `unlockedStage` 최대값을 선택하고 각 단계별 `bestTimeSeconds`/`bestMoveCount`는 더 작은 유효값을 선택한다. currentSession은 가장 최근 `updatedAt`의 유효 세션을 유지한다.

### I02. 생명주기와 복귀 처리
- Related Files:
  - `src/hooks/usePersistedGame.ts` :: `usePersistedGame`; new
  - `src/hooks/usePageVisibilityPause.ts` :: `usePageVisibilityPause`; new
  - `src/App.tsx` :: 저장/복귀 통합; modify

#### Details
- `usePersistedGame`은 상태 변경 시 debounce 250ms로 저장하고 `beforeunload`/`pagehide`에서 즉시 저장한다.
- `document.visibilitychange`에서 hidden이 되면 `PAUSE`를 dispatch하고 저장하며, visible 복귀 시 자동 재개하지 않고 `PauseOverlay`의 Resume을 기다린다.
- 새 앱 시작 시 currentSession이 있으면 일시정지 복구 화면을 표시하고, 버리기 선택 시 currentSession을 삭제한다.
- 타이머는 pause 상태 저장 시 남은 초를 보존하며 브라우저가 닫힌 시간만큼 차감하지 않는다.

## Acceptance Criteria
- [x] 새로고침 후 현재 미로와 위치가 동일하게 복원된다.
- [x] 탭 전환/페이지 복귀 시 자동 일시정지되고 Resume 전에는 타이머가 흐르지 않는다.
- [x] 잘못된/구버전 저장 데이터가 앱을 중단시키지 않는다.
- [x] 계정 연동을 위한 병합 함수가 독립적으로 테스트된다.

## Validation
- `npm test -- --run src/persistence/saveStore.test.ts`
- `npm run build`

## Commit Message
```text
feat(storage) : 미로 게임 저장과 이어하기 구현

계획: 2026-09-29-maze-rescue-game
단계: P03-persistence-assets-validation
작업: T07-persistence-and-resume

- 버전 관리형 localStorage 저장 스키마와 병합 규칙 추가
- 페이지 이탈·탭 전환 시 일시정지하고 같은 미로로 복원
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
