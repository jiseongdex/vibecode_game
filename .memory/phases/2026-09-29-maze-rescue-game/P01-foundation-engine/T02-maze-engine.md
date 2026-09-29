# Task: T02 미로 모델과 완벽 미로 생성기

## Status: done

## Goal
단계 번호만으로 크기와 구출 인원·제한 시간을 계산하고, 매번 다른 완벽 미로를 생성하는 순수 함수 도메인 모듈을 구현한다.

## Decision Summary
- 단계 1은 15×15에서 시작하고 2단계마다 2칸씩 증가하여 20단계는 33×33이다.
- 미로는 모든 칸이 연결되고 두 칸 사이 경로가 하나인 완벽 미로이며, 새 단계/재시작/재플레이마다 새로 생성한다.

## Implementation

### I01. 도메인 타입과 단계 설정
- Related Files:
  - `src/game/types.ts` :: `Cell`, `Maze`, `Position`, `StageConfig`, `Direction`, `EntityPosition`; new
  - `src/game/stageConfig.ts` :: `getStageConfig`, `getRescueCount`, `getMazeSize`, `getTimeLimitSeconds`; new

#### Details
- `Position`은 `{ row: number; col: number }`이다.
- `Cell`은 `{ row: number; col: number; walls: { top: boolean; right: boolean; bottom: boolean; left: boolean }; visited: boolean }`이다.
- `Maze`는 `{ size: number; cells: Cell[][]; seed: number }`이다.
- `StageConfig`은 `{ stage: number; size: number; rescueCount: number; timeLimitSeconds: number }`이다.
- `getMazeSize(stage)`는 유효 범위 1~20을 검사하고 `15 + Math.floor((stage - 1) / 2) * 2`를 반환한다.
- 구조 인원은 구간별 `[1, 1, 1, 1, 2, ...]` 규칙으로 반환한다.
- 제한 시간은 크기와 인원에 비례해 결정되는 순수 계산식으로 고정한다. 기준식은 `Math.ceil(size * size * 0.42 + rescueCount * size * 1.8)`초이며 최소 90초를 보장한다.

### I02. 완벽 미로 생성기
- Related Files:
  - `src/game/mazeGenerator.ts` :: `generateMaze`, `createSeededRandom`, `getReachablePositions`; new

#### Details
- `generateMaze(size: number, random?: () => number): Maze`는 모든 셀의 벽을 초기화하고 randomized recursive backtracker(깊이 우선 탐색)로 인접 미방문 셀 사이 벽을 제거한다.
- 랜덤 함수가 없으면 `crypto.getRandomValues` 기반 seed를 만들고, 테스트에서는 결정적 난수 함수를 주입할 수 있어야 한다.
- 생성 후 모든 셀의 `visited`는 false로 정리한다.
- `getReachablePositions(maze, start)`는 벽을 넘지 않는 BFS로 도달 가능한 칸을 반환한다.
- 시작 위치는 `{ row: 0, col: 0 }`; 탈출구는 시작점에서 최장 거리 후보 중 하나; 구조 대상은 시작/탈출구가 아닌 서로 다른 칸에 배치하도록 후속 도메인에서 사용한다.

### I03. 생성기 테스트
- Related Files:
  - `src/game/mazeGenerator.test.ts` :: 생성·연결성·결정성 테스트; new
  - `src/game/stageConfig.test.ts` :: 단계 설정 테스트; new

#### Details
- 15×15, 33×33의 크기와 모든 셀 존재 여부를 검증한다.
- BFS로 모든 셀에 도달 가능한지, 열린 인접 경로 수가 완벽 미로의 조건을 만족하는지 검증한다.
- 같은 injected random/seed는 동일 결과를, 다른 seed는 일반적으로 다른 벽 배열을 생성하는지 검증한다.
- 1, 4, 5, 16, 17, 20단계의 크기·구출 인원·제한 시간을 검증한다.

## Acceptance Criteria
- [x] 단계 1~20 설정이 결정 문서와 일치한다.
- [x] 생성된 미로가 모든 셀을 연결하고 순환이 없다.
- [x] 랜덤 입력 주입으로 테스트 가능한 순수 생성기다.
- [x] 새 생성마다 seed를 보유하고 저장 가능한 `Maze` 구조를 반환한다.

## Validation
- `npm test -- --run src/game/stageConfig.test.ts src/game/mazeGenerator.test.ts`
- `npm run build`

## Commit Message
```text
기능(게임): 절차적 완벽 미로 엔진 추가

계획: 2026-09-29-maze-rescue-game
단계: P01-foundation-engine
작업: T02-maze-engine

- 미로 및 단계 설정 모델 정의
- 단계별 난이도를 반영한 시드 기반 완벽 미로 생성
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
