# Task: T01 단계별 제한 시간 20% 단축

## Status: done

## Goal
현재 1단계 122초, 20단계 755초인 제한 시간을 각 단계에서 약 20% 단축한다. 현재 미로 크기와 구출 동물 수에 따른 단계별 증가 패턴을 그대로 사용하고, 새 게임과 재시도 모두 새 제한 시간을 받게 한다.

## Decision Summary
- `.memory/decisions/2026-10-01-stage-time-reduction.md` D01: 모든 단계의 기존 제한 시간을 약 20% 단축한다. 1단계 98초, 20단계 604초가 목표다.
- D02~D03: `getTimeLimitSeconds`의 기존 크기·구출 수 계산 결과에 배율을 적용한다. 최소 90초, 유효 단계 1~20, 타이머의 초당 감소·일시정지·승패·HUD 형식은 유지한다.

## Implementation

### I01. 단계 설정의 시간 값 조정
- Related Files:
  - `src/game/stageConfig.ts` :: `getTimeLimitSeconds`, `getStageConfig`, `getMazeSize`, `getRescueCount`; modify (`getTimeLimitSeconds`만)
  - `src/game/types.ts` :: `StageConfig`; read-only
  - `src/game/gameState.ts` :: `createGameState`, `gameReducer`; read-only
  - `src/components/Hud/GameHud.tsx` :: `formatTime`, `GameHud`; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export function getTimeLimitSeconds(stage: number): number
  export function getStageConfig(stage: number): StageConfig
  ```
- **Data & Schema Fields**: `StageConfig`의 `{ stage: number; size: number; rescueCount: number; timeLimitSeconds: number }` 구조는 유지한다. `GameState.remainingSeconds`는 `createGameState`에서 `stageConfig.timeLimitSeconds`로 초기화되므로 새 필드나 상태 이전 로직은 없다.
- **Execution Flow / Logic**:
  1. 현재 코드의 `size = getMazeSize(stage)`, `rescueCount = getRescueCount(stage)`, `calculatedSeconds = Math.ceil(size * size * 0.42 + rescueCount * size * 1.8)`를 그대로 둔다. `getMazeSize`와 `getRescueCount`가 유효 단계 1~20을 검사한다.
  2. 최종 반환만 `Math.max(90, Math.ceil(calculatedSeconds * 0.8))`으로 변경한다. 먼저 기존 공식을 정수 초로 올림한 뒤 0.8배하고 다시 올림해야 기존 시간 대비 약 20% 단축된다. 최소 90초는 단축 후 적용한다.
  3. 예상 결과: `getTimeLimitSeconds(1) === 98`, `(17) === 547`, `(20) === 604`. `getStageConfig`는 이 반환값을 그대로 사용한다.
  4. `createGameState`의 새 게임·재시도 초기화, `gameReducer`의 `TICK`·`PAUSE`·`RESUME`·승패 판정, HUD의 `mm:ss` 표시를 수정하지 않는다. 게임이 실행 중인 상태에 실시간으로 시간을 다시 부여하는 작업은 범위 밖이다.

### I02. 기존 단계 설정 기대값 갱신
- Related Files:
  - `src/game/stageConfig.test.ts` :: `describe('stageConfig')`, 시간 제한 기대값; modify
  - `src/game/gameState.test.ts` :: 재시도 시 단계 설정값 사용 확인; read-only
  - `src/game/integration.test.tsx` :: 제한 시간 만료 흐름 확인; read-only

#### Details
- **Signatures & Types**: 기존 테스트 구조와 함수 호출을 유지한다. 새 테스트 파일이나 fixture를 만들지 않는다.
- **Data & Schema Fields**: 기존 `getStageConfig(17)` 기대 객체에서 `timeLimitSeconds`만 683→547로 변경한다. `stage: 17`, `size: 31`, `rescueCount: 5`는 그대로 둔다.
- **Execution Flow / Logic**:
  1. `getTimeLimitSeconds(1)`의 기대값을 122→98, `(20)`을 755→604로 변경한다.
  2. 미로 크기·구출 수와 잘못된 단계 입력 테스트는 수정하지 않는다.
  3. 기존 게임 상태 및 통합 테스트를 실행해 재시도 초기화와 타이머 만료가 변경된 설정값을 따라가는지 확인한다.

## Acceptance Criteria
- [x] 모든 1~20단계가 기존과 같은 미로 크기·구출 동물 수를 사용하며 제한 시간만 약 20% 줄어든다.
- [x] 1단계 98초, 17단계 547초, 20단계 604초를 반환한다. 최소값 90초와 유효 단계 검사 규칙이 유지된다.
- [x] 새 게임과 재시도에서 새 제한 시간으로 시작하고, 초당 감소·일시정지·시간 만료·HUD 표시는 기존대로 동작한다.

## Validation
- `npm.cmd test -- --run src/game/stageConfig.test.ts src/game/gameState.test.ts src/game/integration.test.tsx` — 단계별 기대값, 재시도 초기화, 시간 만료 흐름 확인.
- `npm.cmd run build` — TypeScript와 Vite 빌드 확인.

## Commit Message
```text
fix(maze): 단계별 제한 시간을 20% 단축

Plan: 2026-10-01-stage-time-reduction
Phase: P01-time-formula
Task: T01-shorten-stage-timers

- 기존 미로 크기와 구출 수 기반 시간에 단축 배율 적용
- 단계 설정의 고정 기대값 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (관련 테스트 22개, 빌드)
- commit: Git 기록 참조
