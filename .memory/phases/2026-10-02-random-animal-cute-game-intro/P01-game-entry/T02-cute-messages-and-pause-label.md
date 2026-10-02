# Task: T02 주아 안내 폰트와 쉬기 문구

## Status: done

## Goal

안내·알림 문구가 기존 손글씨 UI와 구분되는 주아(Jua)로 보이게 하고, HUD의 일시 정지 버튼을 `잠깐 쉬기`로 표시한다.

## Decision Summary

- 주아는 로컬 웹폰트로 제공한다. 일반 UI, 단계 숫자/기록, 조작 및 행동 버튼의 `Nanum Pen Script`는 유지한다.
- HUD 버튼 **표시 문구만** `잠깐 쉬기`로 바꾼다. 일시 정지 dialog 제목 `일시정지`, `이어하기` 기능과 접근성 역할은 유지한다.

## Implementation

### I01. 로컬 Jua 자산과 범위별 글꼴 토큰

- Related Files:
  - `public/assets/fonts/Jua-Regular.ttf` — Google Fonts 원본의 Jua Regular 파일; new
  - `public/assets/fonts/OFL-Jua.txt` — 해당 글꼴의 SIL OFL 전문; new
  - `src/styles/global.css` :: `@font-face`, `body > #root > main > header p` — 로컬 폰트 등록과 첫 화면 안내 문구; modify
  - `src/styles/tokens.css` :: `:root` — `--font-message` 추가; modify
  - `src/components/Campaign/CampaignScreen.module.css` :: `.intro`, `.pickerLabel`, `.complete` — 단계 선택의 안내/완료 문구; modify
  - `src/components/Hud/GameHud.module.css` :: `.warning` — 남은 시간 부족 알림; modify
  - `src/components/Overlays/Overlays.module.css` :: `.panel h2`, `.panel p` — 일시 정지·결과 알림 문구; modify
  - `src/components/GameScreen/GameScreen.module.css` :: T03의 시작 문구·숫자 스타일 — T03에서 토큰 사용; read-only

#### Details

- **Signatures & Types**: CSS 글꼴 토큰 `--font-message: 'Jua', 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif`. `@font-face { font-family: 'Jua'; src: url('/assets/fonts/Jua-Regular.ttf') format('truetype'); font-style: normal; font-weight: 400; font-display: swap; }`.
- **Data & Schema Fields**: 런타임 상태/저장 필드는 없다. 원본 출처는 `https://github.com/google/fonts/tree/main/ofl/jua`; 내려받을 파일은 `Jua-Regular.ttf`와 `OFL.txt`이며, 로컬 라이선스 이름은 기존 나눔펜 `OFL.txt`를 덮지 않도록 `OFL-Jua.txt`로 한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 공식 `google/fonts` 저장소에서 파일을 가져와 프로젝트 로컬 자산으로 둔다. 글꼴과 라이선스가 비어 있지 않은지 확인한다.
  2. Core Processing: `global.css`에 Jua face를 등록하고 `tokens.css`에 별도 토큰을 둔다. 첫 화면 설명, 단계 선택의 `.intro/.pickerLabel/.complete`, HUD의 `.warning`, 일시 정지/결과 패널의 제목과 설명에 `font-family: var(--font-message)`를 적용한다. T03의 시작 안내/카운트다운도 이 토큰을 사용하게 청사진에 명시한다.
  3. Error & Exception Handling: 로컬 파일을 사용할 수 없어도 토큰의 한국어 시스템 글꼴로 읽을 수 있어야 한다. `font-display: swap`으로 웹폰트 로딩 중 문구를 숨기지 않는다. 숫자 HUD 배지, `.progress`, 단계 버튼, 모든 행동 버튼에 새 토큰을 일괄 적용하지 않는다.
  4. State Transition & Return: DOM 텍스트와 CSS만 바뀐다. 게임 상태 전환은 없다.

### I02. HUD 버튼 문구와 테스트

- Related Files:
  - `src/components/Hud/GameHud.tsx` :: `GameHud` — 버튼 텍스트 `일시정지` → `잠깐 쉬기`; modify
  - `src/components/Hud/GameHud.test.tsx` :: `GameHud` 버튼 검색과 클릭 기대값; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: HUD 버튼을 찾는 기존 테스트 3곳; modify
  - `src/components/Overlays/PauseOverlay.tsx` :: `PauseOverlay`의 dialog 제목; read-only

#### Details

- **Signatures & Types**: `GameHudProps { stage: number; remainingSeconds: number; rescuedCount: number; rescueCount: number; onPause: () => void; canPause?: boolean }`와 `formatTime(totalSeconds: number): string`은 유지한다.
- **Data & Schema Fields**: `GameHud`의 `canPause` disabled 조건, `remainingSeconds <= 10` 경고 조건, `role='timer'`/`role='status'` 및 `aria-live`는 그대로다.
- **Execution Flow / Logic**:
  1. 버튼 표시 텍스트만 바꾸고 `onPause`와 disabled 연결은 유지한다.
  2. `GameHud.test.tsx`, `GameScreen.test.tsx`에서 버튼의 접근성 이름을 `잠깐 쉬기`로 기대한다. `role='dialog', name='일시정지'` 테스트는 변경하지 않는다.
  3. 기존 작은 화면의 `.hud` 줄바꿈/버튼 최소 높이 44px, `.panel` 미디어 쿼리가 새 폰트로도 긴 한글 문구를 자르지 않는지 확인한다.

## Acceptance Criteria

- [x] 안내·알림과 카운트다운용 `--font-message`가 로컬 Jua를 우선 사용하고 일반 UI/버튼은 기존 글꼴을 유지한다.
- [x] 로컬 글꼴과 별도 OFL 라이선스 파일이 존재한다.
- [x] HUD 버튼은 `잠깐 쉬기`로 읽히며 클릭·disabled·일시 정지 dialog 동작은 유지된다.

## Validation

- `npm.cmd test -- --run src/components/Hud/GameHud.test.tsx src/components/GameScreen/GameScreen.test.tsx` — HUD 버튼·일시 정지 회귀 통과.
- `npm.cmd run build` — 타입과 정적 자산 참조를 포함한 빌드 통과.
- `Test-Path public/assets/fonts/Jua-Regular.ttf; Test-Path public/assets/fonts/OFL-Jua.txt` — 두 로컬 파일 존재 확인.
- 브라우저에서 단계 선택/결과/경고 문구와 기존 버튼의 글꼴 차이, 320px 폭과 낮은 가로 화면 줄바꿈을 확인한다.

## Commit Message

```text
style(ui): 안내 문구에 주아 폰트를 적용하고 쉬기 버튼명 변경

Plan: 2026-10-02-random-animal-cute-game-intro
Phase: P01-game-entry
Task: T02-cute-messages-and-pause-label

- 주아 글꼴과 라이선스를 로컬 자산으로 추가
- 안내·알림 문구와 HUD 쉬기 버튼을 조정
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (지정 테스트 12개, 빌드, 소스·배포 자산 존재 확인)
- [ ] 브라우저 육안 확인 (이번 환경에 연결된 브라우저가 없어 수행 불가)
- commit: Git 기록 참조
