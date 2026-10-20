# Task: T03 플레이 화면 주변 UI

## Status: done

## Goal

플레이 화면의 HUD, 시작/이동/일시정지/결과 버튼과 팝업을 단계 선택 지도와 같은 귀여운 동화책 디자인으로 바꾼다. 미로는 크게 보이되 화면 바깥 UI가 시야·조작을 방해하지 않게 한다.

## Decision Summary

- 크림·민트·딸기 포인트, 손글씨 글꼴, 캡슐/스티커 버튼, 잎·버섯·발자국 SVG 장식을 공통으로 사용한다.
- 기능을 바로 이해할 수 있는 한국어 버튼명과 상태 문구를 유지하면서 설명 문장만 따뜻한 모험 말투로 다듬는다.
- 미로 타일·캐릭터/동물 이미지, 깊이 렌더링, 움직임·시간·저장 규칙은 건드리지 않는다.

## Implementation

### I01. HUD와 게임 프레임, 조작 버튼

- Related Files:
  - `src/components/GameScreen/GameScreen.tsx` :: 시작 버튼 문구/장식; modify
  - `src/components/GameScreen/GameScreen.module.css` :: `.screen`, `.actions`; modify
  - `src/components/Hud/GameHud.tsx` :: `GameHud`의 표시 마크업/장식; modify
  - `src/components/Hud/GameHud.module.css` :: `.hud`, `.stats`, `.urgent`, 일시정지 버튼; modify
  - `src/components/Controls/DirectionControls.tsx` :: 버튼의 SVG 장식이 필요한 경우만; optional modify
  - `src/components/Controls/DirectionControls.module.css` :: `.controls`, `.button`, 방향 배치/터치 상태; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport` 테두리/그림자/반경만; optional modify
  - `src/components/Decorations/StickerIcon.tsx` :: T01 장식 사용; read-only

#### Details

- **Signatures & Types**: 기존 `GameHudProps { stage: number; remainingSeconds: number; rescuedCount: number; rescueCount: number; onPause: () => void; canPause?: boolean }`, `DirectionControlsProps { disabled?: boolean; onMove: (direction: Direction) => void }`를 유지한다. `formatTime(totalSeconds: number): string`도 변경하지 않는다.
- **Data & Schema Fields**: 상태 필드 `state.status`, `state.remainingSeconds`, `state.stageConfig.stage`, `state.stageConfig.rescueCount`, `state.rescues`는 그대로 사용한다. 새 저장 필드는 없다. CSS는 T01 토큰 `--color-paper`, `--color-mint`, `--color-strawberry`, `--color-leaf`, `--shadow-sticker`, `--font-ui`를 사용한다.
- **Execution Flow / Logic**:
  1. HUD를 세 개의 읽기 쉬운 둥근 배지(단계, 남은 시간, 구조 수)와 일시정지 캡슐 버튼으로 재배치한다. 각 숫자 및 라벨은 텍스트로 남긴다. `role="timer"`, `role="status"`, `aria-live`, `data-urgent` 및 10초 이하 경고의 기능을 유지한다. 경고는 딸기/진한 빨강 색상과 글/형태로 표현하고 `prefers-reduced-motion`에선 깜박임을 없앤다.
  2. `.screen`은 기존 최대 너비 `1240px`와 미로 중심 정렬을 유지한다. `.viewport`를 수정할 경우 테두리 성격만 바꾸며 높이 `min(88vh, 840px)`, 모바일 `min(65vh, 590px)`, 낮은 가로 화면 `min(58vh, 400px)` 등 시야 스펙은 유지한다. 미로 내부 `.board`, `.cell`, `.wallBlock`, `.sprite` 등은 건드리지 않는다.
  3. 시작 버튼과 방향 버튼에 통통한 표면·그림자·눌림 상태를 주되 방향 버튼의 3×2 십자 배치와 각 최소 44px 터치 영역을 유지한다. 방향 화살표는 기존 상징을 계속 사용하고 버튼의 `aria-label`, disabled, `touch-action:none`을 유지한다. 호버만으로 조작 의미를 전달하지 않는다.
  4. 낮은 가로 화면에서도 헤더+HUD+미로+방향키가 가능한 만큼 들어오게 기존 media query를 조정한다. 세로 스크롤이 생기더라도 조작키가 화면 바깥에 숨거나 덮이지 않게 한다.
- **Error & Exception Handling**: 버튼 disabled 상태는 여전히 실행되지 않는다. 긴 숫자/한글이 320px 폭에서 넘치면 HUD 배지 줄바꿈으로 해결하고 축소하여 읽기 어려워지지 않게 한다.
- **State Transition & Return**: `dispatch`, 타이머 interval, `onMove`, `pauseAndSave`, `onStateChange` 동작은 그대로다.

### I02. 일시정지/결과 팝업과 문구

- Related Files:
  - `src/components/Overlays/PauseOverlay.tsx` :: `PauseOverlay` 제목/안내/버튼 문구와 장식; modify
  - `src/components/Overlays/ResultOverlay.tsx` :: `ResultOverlay` 승리/실패 문구와 장식; modify
  - `src/components/Overlays/Overlays.module.css` :: `.overlay`, `.panel`, `.actions`; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: 기존 사용자용 문구가 달라졌을 때만 assertion 갱신; modify
  - `src/components/Hud/GameHud.test.tsx` :: 기존 사용자용 문구가 달라졌을 때만 assertion 갱신; optional modify
  - `src/App.test.tsx` :: 일시정지/재개/버리기 사용자용 문구가 달라졌을 때만 assertion 갱신; optional modify

#### Details

- **Signatures & Types**: `PauseOverlayProps { onResume: () => void; onDiscard?: () => void }`와 `ResultOverlayProps { status: 'won' | 'lost'; stage: number; clearTimeSeconds: number; onRetrySameMaze: () => void; onRestartNewMaze: () => void; onNextStage?: () => void; onCampaign?: () => void }` 유지.
- **Data & Schema Fields**: 결과 문구에서 `stage`, `clearTimeSeconds`, `status`만 표시하고 새 데이터는 만들지 않는다. `formatTime()`으로 클리어 시간을 표기한다.
- **Execution Flow / Logic**:
  1. 팝업은 종이 카드·부드러운 테두리·버섯/발자국 작은 SVG 장식으로 통일한다. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` 및 고유 제목 id를 유지한다. 읽기 순서는 제목→짧은 안내→행동 버튼이다.
  2. 일시정지 제목 `일시정지`, 버튼 `이어하기`, `게임 버리고 단계 선택` 등 기능명이 바로 보이는 텍스트를 유지한다. 안내는 `잠깐 쉬어 가요. 남은 시간은 멈춰 있어요.`처럼 따뜻하지만 정확하게 적는다.
  3. 결과의 승리/실패/20단계 완료 분기는 그대로 둔다. `같은 미로 재도전`, `새 미로로 다시`, `다음 단계`, `단계 선택` 등 기능 버튼은 뜻을 흐리지 않는다. 승리 때 기록 수치와 실패 때 탈출 목표가 보인다.
  4. 작은 화면에서는 팝업 폭과 버튼 줄바꿈을 조정하여 미로 viewport 안에서 잘리지 않게 한다. 팝업 장식은 `pointer-events:none`이고 스크린 리더에서 숨긴다. 기존 버튼 콜백 연결을 그대로 둔다.
- **Error & Exception Handling**: `onDiscard`, `onCampaign`, `onNextStage`가 없을 때 기존 조건부 버튼 렌더링을 유지한다. 마지막 20단계에서 다음 단계 버튼을 보이지 않는다.
- **State Transition & Return**: 재개/재도전/새 미로/다음 단계/단계 선택 액션의 기존 상태 전환은 그대로다.

## Acceptance Criteria

- [ ] HUD, 시작/방향/일시정지/결과 UI가 단계 선택과 같은 크림·민트·딸기 스티커 디자인이다.
- [ ] 모바일 320~390px 및 낮은 가로 화면에서 미로와 조작키/팝업이 사용 가능하고 글이 잘리지 않는다.
- [ ] 시간 경고, rescue count, 단계 수, 클리어 시간과 버튼 기능이 정확하게 유지된다.
- [ ] 시야 크기, 타일/캐릭터/동물 자산, 게임 진행과 저장 로직이 유지된다.
- [ ] 키보드 포커스, 터치 목표 크기, `prefers-reduced-motion`, dialog 이름이 유지된다.

## Validation

- `npm.cmd test -- --run src/components/GameScreen/GameScreen.test.tsx src/components/Hud/GameHud.test.tsx src/components/Controls/DirectionControls.test.tsx src/App.test.tsx` — 조작/상태/팝업 회귀 확인.
- `npm.cmd run build` — 최종 타입·정적 번들 확인.
- 브라우저에서 데스크톱, 390×844 모바일, 낮은 가로 화면의 단계 선택→시작→이동→일시정지→이어하기→결과 흐름을 시각 확인. 오프라인 글꼴과 포커스/터치 상태도 확인.

## Commit Message

```text
fix(maze): 플레이 화면을 귀여운 탐험 수첩 디자인으로 통일

Plan: 2026-10-01-cute-game-web-ui
Phase: P01-storybook-ui
Task: T03-game-chrome

- HUD와 시작·방향 조작 버튼을 스티커 형태로 변경
- 일시정지·결과 팝업 문구와 카드 디자인 통일
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (게임·HUD·조작·앱 테스트 19개, 빌드, 데스크톱·모바일·낮은 가로 화면 렌더링)
- commit: Git 기록 참조
