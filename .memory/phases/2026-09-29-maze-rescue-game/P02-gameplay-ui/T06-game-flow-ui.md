# Task: T06 HUD와 단계 흐름 화면

## Status: done

## Goal
단계 번호·남은 시간·구출 진행도·이동 횟수를 보여주고, 일시정지/이어하기·시간 초과·단계 완료·20단계 완료 흐름을 화면으로 제공한다.

## Decision Summary
- 순차 해금하되 완료 단계는 재플레이한다.
- 페이지 복귀 시 일시정지 상태에서는 이어하기 버튼을 표시한다.
- 시간 초과 시 같은 미로 재도전 또는 새 미로 재시작을 선택한다.

## Implementation

### I01. HUD와 오버레이
- Related Files:
  - `src/components/Hud/GameHud.tsx` :: `GameHud`; new
  - `src/components/Hud/GameHud.module.css` :: HUD 스타일; new
  - `src/components/Overlays/PauseOverlay.tsx` :: `PauseOverlay`; new
  - `src/components/Overlays/ResultOverlay.tsx` :: `ResultOverlay`; new

#### Details
- HUD props는 `{ stage, remainingSeconds, rescuedCount, rescueCount, moveCount, onPause }`다.
- 시간은 `mm:ss`로 표시하고 10초 이하에는 경고 스타일을 적용한다.
- PauseOverlay는 `Resume` 버튼을, ResultOverlay는 `won/lost`에 따라 결과·기록·retry same maze·restart new maze 버튼을 제공한다.
- 승리 결과에는 클리어 시간과 이동 횟수를 표시한다.

### I02. 캠페인/단계 선택
- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreen`; new
  - `src/components/Campaign/CampaignScreen.module.css` :: 단계 선택 스타일; new

#### Details
- `CampaignScreen`은 1~20 단계 버튼을 렌더링하고 해금된 단계만 활성화한다.
- 완료 단계에는 최고 시간/이동 횟수를 표시하고 재플레이를 허용한다.
- 신규 단계 시작 시 `generateMaze`와 `createGameState`를 호출한다.
- 20단계 완료 시 최종 완료 메시지와 전체 진행 요약을 제공한다.

### I03. UI 테스트
- Related Files:
  - `src/components/Hud/GameHud.test.tsx` :: HUD/오버레이 테스트; new
  - `src/components/Campaign/CampaignScreen.test.tsx` :: 해금/재플레이 테스트; new

#### Details
- 구조 진행도, 타이머 형식, 이동 횟수를 검증한다.
- pause/resume, 동일 미로 재도전, 새 미로 재시작 callback을 검증한다.
- 해금되지 않은 단계가 disabled이고 완료 단계가 다시 선택 가능한지 검증한다.

## Acceptance Criteria
- [x] 플레이 중 핵심 상태가 항상 HUD에 보인다.
- [x] 일시정지·성공·실패·최종 완료 화면이 서로 구분된다.
- [x] 이전 단계 재플레이 및 해금 단계 제한이 동작한다.
- [x] 시간 초과 결과에서 두 가지 재시작 선택이 제공된다.

## Validation
- `npm test -- --run src/components/Hud/GameHud.test.tsx src/components/Campaign/CampaignScreen.test.tsx`
- `npm run build`

## Commit Message
```text
feat(ui) : 게임 HUD와 20단계 캠페인 흐름 추가

계획: 2026-09-29-maze-rescue-game
단계: P02-gameplay-ui
작업: T06-game-flow-ui

- 남은 시간, 구조 진행도, 이동 횟수와 기록 표시
- 일시정지, 결과, 재도전, 순차 해금 화면 연결
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
