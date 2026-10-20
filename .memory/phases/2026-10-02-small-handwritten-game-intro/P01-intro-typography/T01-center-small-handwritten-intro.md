# Task: T01 작은 손글씨 시작 안내

## Status: done

## Goal

게임 시작 안내 문구에 이미 등록된 손글씨 폰트를 적용하고 문구와 카운트다운 숫자를 모두 축소한다. 미로 틀 내부 중앙 배치와 기존 6초 자동 시작 흐름은 유지한다.

## Decision Summary

- 단계 진입 순서는 `message(3000ms) → 3(1000ms) → 2(1000ms) → 1(1000ms) → START`이다. 결과 화면 재도전은 숫자부터 시작한다. 이 Task는 시작 상태·타이머 코드를 변경하지 않는다.
- 문구만 기존 `Nanum Pen Script`, 숫자는 기존 `Jua`를 사용한다. 최대 글자 크기를 각각 58→36px, 164→82px로 낮춘다.

## Implementation

### I01. 문구와 숫자 폰트·크기 분리

- Related Files:
  - `src/components/GameScreen/GameScreen.module.css` :: `.introMessage`, `.introNumber`, `.introOverlay` — 글꼴과 크기 조정; modify
  - `src/styles/tokens.css` :: `--font-ui`, `--font-message` — 각각 Nanum Pen Script/Jua가 이미 등록된 토큰; read-only
  - `src/styles/global.css` :: `@font-face` — 두 로컬 글꼴이 이미 정의된 상태; read-only
  - `public/assets/fonts/NanumPenScript-Regular.ttf` :: 손글씨 폰트 자산; read-only

#### Details

- **Signatures & Types**:
  ```css
  .introMessage { font-family: var(--font-ui); font-size: clamp(22px, 3vw, 36px); }
  .introNumber { font-family: var(--font-message); font-size: clamp(48px, 8vw, 82px); }
  ```
- **Data & Schema Fields**: 새 게임 상태 필드·저장 필드·API는 없다. 기존 CSS 변수 `--font-ui: 'Nanum Pen Script', ...`와 `--font-message: 'Jua', ...`를 재사용한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 현재 `.introMessage, .introNumber`의 공통 규칙에 `font-family: var(--font-message)`가 있으며, 각 선택자는 별도로 `font-size: clamp(20px, 5vw, 58px)`와 `clamp(64px, 18vw, 164px)`를 가진다.
  2. Core Processing: 공통 규칙의 `font-family`만 제거하고 각 선택자에 위의 전용 `font-family`를 둔다. 각 `font-size`를 위의 작은 clamp 값으로 교체한다. 공통 `font-weight`, `line-height`, `text-shadow`와 `.introMessage`의 `max-width`, `overflow-wrap`은 유지한다.
  3. Layout & Error Handling: `.introOverlay`의 `position: absolute`, `inset: var(--frame-border)`, `display: grid`, `place-items: center`, 반투명 배경과 `pointer-events: none`은 유지한다. 손글씨 폰트 로딩에 실패하면 `--font-ui`에 이미 지정된 한글 시스템 글꼴로 대체된다. 새 글꼴 다운로드나 전역 폰트 토큰 변경은 필요 없다.
  4. State Transition & Return: CSS 외 게임 상태 전이는 없다. 시작 전/후 오버레이 표시와 결과 화면 재도전 분기는 기존 `GameScreen` 구현을 그대로 따른다.

### I02. 회귀 및 작은 화면 검증

- Related Files:
  - `src/components/GameScreen/GameScreen.test.tsx` :: `GameScreen`의 안내 경계·재도전·숨김 탭 테스트 — 동작 계약 검증; read-only
  - `src/App.test.tsx` :: 단계 선택·저장 복원 테스트 — 통합 흐름 검증; read-only
  - `src/components/GameScreen/GameScreen.tsx` :: `IntroStep`, 타이머 effect, `data-testid="intro-overlay"`, `--frame-border` — 기존 동작 확인; read-only

#### Details

- **Signatures & Types**: `IntroStep = 'message' | 3 | 2 | 1 | null`은 그대로다. 테스트는 게임 상태 및 DOM 카운트다운에 관한 기존 검증을 사용한다. CSS만 바꾸므로 DOM만 모방하는 새 단위 테스트는 만들지 않는다.
- **Data & Schema Fields**: `GameState.status`와 `remainingSeconds`, 저장 스키마에는 변경이 없다.
- **Execution Flow / Logic**:
  1. CSS 값 확인: 문구 글꼴은 `var(--font-ui)`, 숫자 글꼴은 `var(--font-message)`이고 clamp 최대값은 각각 36px·82px여야 한다. 크기를 줄여도 중앙 정렬과 미로 테두리 inset은 남아 있어야 한다.
  2. 자동 테스트: 아래 지정 테스트, 전체 테스트와 빌드를 실행한다. 안내 3000ms, 숫자 1000ms씩, 재도전 숫자만, 숨김 중 정지, 복원 시 일시 정지는 기존 테스트가 확인한다.
  3. 시각 검증: 브라우저가 연결되어 있으면 데스크톱, 390×844 모바일, 낮은 가로 화면에서 안내 문구·숫자가 미로 틀 안쪽 중앙에 작게 보이고 잘리지 않는지 확인한다. 브라우저 연결이 없으면 미실시 사실을 기록한다.

## Acceptance Criteria

- [x] 단계 진입 안내 문구는 Nanum Pen Script이고 카운트다운 숫자는 Jua이다.
- [x] 문구와 숫자 모두 현재보다 작으며 기존 미로 틀 내부 중앙 정렬을 유지한다.
- [x] 단계 진입·재도전 순서와 시간, 입력·타이머 차단, 저장 복원은 바뀌지 않는다.
- [x] 새 폰트 자산이나 전역 UI 폰트 변경이 없다.

## Validation

- `npm.cmd test -- --run src/components/GameScreen/GameScreen.test.tsx src/App.test.tsx` — 안내 순서·시간·재도전·복원 테스트 통과.
- `npm.cmd test -- --run` — 전체 회귀 통과.
- `npm.cmd run build` — 타입 검사와 번들 통과.
- 가능할 때 브라우저에서 데스크톱, 390×844, 낮은 가로 화면으로 문구·숫자 크기와 프레임 내부 중앙 정렬 확인.

## Commit Message

```text
style(game): 시작 안내를 작은 손글씨로 조정

Plan: 2026-10-02-small-handwritten-game-intro
Phase: P01-intro-typography
Task: T01-center-small-handwritten-intro

- 안내 문구에 기존 손글씨 글꼴 적용
- 카운트다운 문구와 숫자를 미로 중앙에 작게 표시
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (지정 테스트 18개, 전체 125개, 빌드)
- [ ] 브라우저 육안 확인 (연결된 브라우저가 없어 수행 불가)
- commit: Git 기록 참조
