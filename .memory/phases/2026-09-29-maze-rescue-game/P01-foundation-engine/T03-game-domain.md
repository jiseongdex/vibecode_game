# Task: T03 게임 도메인 상태 머신

## Status: done

## Goal
미로에서의 플레이어 이동, 구조 대상 배치/추적, 탈출구 조건, 이동 횟수, 제한 시간과 승패 상태를 UI와 독립된 reducer/API로 구현한다.

## Decision Summary
- 목표 칸에 진입하면 자동 구출하며, 모든 대상을 구출한 뒤 탈출구에 도착해야 클리어된다.
- 구출한 캐릭터는 플레이어 뒤를 일렬로 따라온다.
- 시간 초과 시 같은 미로 재도전 또는 새 미로 재시작을 선택한다.

## Implementation

### I01. 게임 상태와 액션
- Related Files:
  - `src/game/gameState.ts` :: `GameState`, `GameStatus`, `GameAction`, `createGameState`, `gameReducer`; new
  - `src/game/entityPlacement.ts` :: `placeEntities`, `moveFollowers`; new

#### Details
- `GameState`는 `{ stageConfig, maze, player, exit, rescues, followers, moveCount, remainingSeconds, status, startedAt, pausedAt, seed }`를 포함한다.
- `GameStatus`는 `'ready' | 'playing' | 'paused' | 'won' | 'lost'`다.
- `GameAction`은 `START`, `MOVE`, `TICK`, `PAUSE`, `RESUME`, `RETRY_SAME_MAZE`, `RESTART_NEW_MAZE`를 포함한다.
- `MOVE`는 상하좌우 이외 방향을 무시하고, 벽이 있거나 보드 밖이면 상태를 변경하지 않는다. 유효 이동만 이동 횟수를 1 증가시킨다.
- 이동 후 현재 칸이 구조 대상이면 해당 대상을 rescued 처리하고 followers 배열 끝에 이전 플레이어 경로 위치를 추가한다.
- 모든 구조 대상이 rescued이고 현재 칸이 exit이면 `won`; `TICK`으로 0초가 되면 `lost`로 전환한다.
- `PAUSE`와 `RESUME`은 타이머 상태를 함께 전환하며 `paused` 중에는 `TICK`을 무시한다.

### I02. 도메인 테스트
- Related Files:
  - `src/game/gameState.test.ts` :: reducer 시나리오 테스트; new

#### Details
- 벽 충돌/보드 밖 이동/유효 이동과 이동 횟수를 검증한다.
- 구조 대상 접촉, 일렬 follower 갱신, 구조 전 탈출구 도착 불가, 전원 구조 후 승리를 검증한다.
- `PAUSE` 중 `TICK` 무시, 0초 `lost`, retry/restart 상태 초기화를 검증한다.

## Acceptance Criteria
- [x] UI 없이 reducer 테스트만으로 핵심 게임 규칙이 검증된다.
- [x] 모든 상태 전이가 불변 업데이트로 처리된다.
- [x] 구조 전 탈출구로 클리어할 수 없다.
- [x] follower가 플레이어의 직전 경로를 따라 일렬로 갱신된다.

## Validation
- `npm test -- --run src/game/gameState.test.ts`
- `npm run build`

## Commit Message
```text
feat(game) : 미로 구출 게임 상태 머신 구현

계획: 2026-09-29-maze-rescue-game
단계: P01-foundation-engine
작업: T03-game-domain

- 불변 게임 상태 전이와 구출 대상 배치 구현
- 이동, 호송, 제한 시간, 승패 및 재도전 규칙 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
