# Task: T01 구출 동물 무작위 배정

## Status: done

## Goal

새 게임의 미로 시드마다 5종 동물에서 단계 구출 수(1~5)만큼 중복 없이 배정하고, 같은 미로 재도전·저장 복원에서는 그 배정을 유지한다.

## Decision Summary

- 새 미로/단계 진입은 무작위 배정, 같은 미로 재도전은 동일 배정이다. 새 동물 자산이나 저장 필드는 만들지 않는다.
- 구출 대상 ID는 현재 `getRescueAnimal(id)`이 해석하는 `rescue-1`~`rescue-5`를 유지하되, **ID를 자리 순서에 고정하지 않고** 시드 기반 순열로 배정한다.

## Implementation

### I01. 미로 시드 기반 동물 ID 순열

- Related Files:
  - `src/game/gameState.ts` :: `createGameState(stage, maze?)`, 새 `shuffledRescueIds(seed)` — 구출 위치에 동물 ID 배정; modify
  - `src/assets/assetManifest.ts` :: `rescueAnimals`, `getRescueAnimal(id)` — 5종 목록과 ID 매핑의 단일 출처; read-only
  - `src/game/mazeGenerator.ts` :: `createSeededRandom(seed)` — 별도 시드 스트림; read-only
  - `src/game/entityPlacement.ts` :: `placeEntities(maze, rescueCount)` — 기존 위치 배치와 기본 ID 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  function shuffledRescueIds(seed: number): string[]
  export function createGameState(stage: number, maze?: Maze): GameState
  export type RescueTarget = EntityPosition & { rescued: boolean }
  // EntityPosition: { id: string; row: number; col: number }
  ```
- **Data & Schema Fields**: `GameState.rescues: RescueTarget[]`의 기존 `id`, `row`, `col`, `rescued` 필드만 사용한다. `GameState.seed: number`, `Maze.seed: number`, `StageConfig.rescueCount: number`는 그대로다. `SAVE_VERSION=4`와 저장 구조는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 기존 `getStageConfig(stage)`와 미로 크기 검증을 유지한다. `rescueCount <= rescueAnimals.length`가 깨지면 명시적 `RangeError`를 던져 5종보다 많은 목표가 조용히 중복되지 않게 한다.
  2. Core Processing: `rescueAnimals`의 배열 인덱스로 `rescue-1`~`rescue-5` ID를 만든다. `createSeededRandom(seed ^ 0x51a3c7d2)`처럼 위치 배치와 다른 고정 salt의 RNG로 Fisher–Yates 셔플을 한다. `placeEntities`가 만든 목표 위치 순서를 유지한 채, `createGameState`의 `rescues.map((target, index) => ...)`에서 ID만 셔플 배열의 `index` 값으로 덮어쓴다. 논리 좌표를 확장 그리드 좌표로 바꾸는 기존 `logicalToGridPosition`도 유지한다.
  3. Error & Exception Handling: 시드는 기존 `Maze.seed`의 uint32 값을 사용하고 위치 배치용 RNG를 소비하지 않는다. 같은 seed에서는 같은 순열이므로 재도전이 동일하다. 서로 다른 seed에서 같은 동물이 다시 나올 수 있는 것은 정상적인 무작위 결과다.
  4. State Transition & Return: `RETRY_SAME_MAZE`는 동일 `state.maze`로 초기 상태를 만들되, **기존 `state.rescues`의 위치(`row:col`)별 `id`를 새 목표에 다시 붙인다.** 구조 후 배열은 구출 순서로 재정렬되므로 배열 index로 매칭하면 안 된다. 이렇게 해야 업데이트 전에 저장된 고정 ID 세션도 같은 미로 재도전 시 동물이 그대로다. `RESTART_NEW_MAZE`, 단계 선택, 다음 단계는 새 미로 시드를 사용한다. `getRescueAnimal`, `RescueSprite`, follower 구조는 바꾸지 않는다.

### I02. 동물 정체성 회귀 검증

- Related Files:
  - `src/game/gameState.test.ts` :: `gameReducer` 테스트 — 시드 결정성과 단계별 중복 없는 ID; modify
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `uses five distinct local animal images...` — 고정 순서 가정 제거, follower 동일 동물 검증; modify
  - `src/persistence/saveStore.test.ts` :: `saveStore` — 섞인 ID 저장·복원; modify

#### Details

- **Signatures & Types**: 테스트는 `createGameState(1|5|20, generateMaze(size, createSeededRandom(seed)))`, `gameReducer(..., { type: 'RETRY_SAME_MAZE' })`, `saveSave/loadSave`, `getRescueAnimal(id)`을 사용한다.
- **Data & Schema Fields**: 각 `rescue.id`는 `/^rescue-[1-5]$/`에 맞고 서로 달라야 한다. 단계 20의 ID 집합은 정확히 5종이다.
- **Execution Flow / Logic**:
  1. 같은 미로 인스턴스로 여러 번 `createGameState`를 호출해 ID 배열과 위치가 동일한지 확인한다. 여러 다른 고정 시드에서는 최소 두 가지 ID 순서가 나오는지 확인하되, **서로 다른 두 시드가 반드시 다르다**는 확률적 단언은 하지 않는다.
  2. `RETRY_SAME_MAZE`는 원본 ID·위치를 그대로 재생성한다. 특히 업데이트 이전 방식의 `rescue-1..N` 고정 ID를 가진 상태와 구출 순서로 `rescues`가 재정렬된 상태에서도 **위치별 동물**이 유지되는지 확인한다. 새 미로는 seed와 새 ID 순열을 기반으로 생성된다.
  3. `MazeBoard.test.tsx`의 토끼→강아지 고정 순서 단언을 5종 이름/이미지의 집합 검증으로 바꾼다. 마지막 대상의 follower가 `getRescueAnimal(rescued.id)`의 이름/전면 이미지와 같음을 확인한다.
  4. 저장 테스트에서 무작위 ID가 `SAVE_VERSION=4`로 왕복하고 기존 고정 ID 저장 데이터도 계속 읽히는지 확인한다.

## Acceptance Criteria

- [x] 새 미로의 1~5마리는 5종 중에서 중복 없이 나타난다.
- [x] 같은 미로 재도전과 저장 복원에서 각 대상·follower의 동물 정체성이 유지된다.
- [x] 기존 위치, 구조, 시간, 저장 버전은 그대로다.

## Validation

- `npm.cmd test -- --run src/game/gameState.test.ts src/components/MazeBoard/MazeBoard.test.tsx src/persistence/saveStore.test.ts` — 동물 배정·follower·저장 회귀 통과.
- `npm.cmd run build` — 타입과 번들 통과.

## Commit Message

```text
feat(game): 새 미로 구출 동물을 중복 없이 무작위 배정

Plan: 2026-10-02-random-animal-cute-game-intro
Phase: P01-game-entry
Task: T01-random-rescue-animals

- 미로 시드 기반 동물 ID 순열을 구출 대상에 배정
- 같은 미로 재도전과 저장 복원의 동물 정체성 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (지정 테스트 42개, `npm.cmd run build`)
- commit: Git 기록 참조
