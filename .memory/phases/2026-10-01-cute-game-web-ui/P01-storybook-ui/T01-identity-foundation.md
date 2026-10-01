# Task: T01 공통 시각 정체성과 게임 제목

## Status: done

## Goal

앱 어디서나 동일한 손글씨 글꼴과 따뜻한 종이·민트·딸기색 토큰을 사용할 수 있게 한다. 브라우저 탭과 헤더의 제목을 `동물 구출 대작전`으로 통일하고 이후 작업에서 재사용할 SVG 장식을 만든다.

## Decision Summary

- Nanum Pen Script Regular를 로컬에 포함하며 OFL 라이선스도 같이 둔다. UI 전체에 적용하되 실제 읽기 크기·대비·줄 간격을 보장한다.
- 제목은 `동물 구출 대작전`, 부제는 `알록달록한 미로를 지나 친구들을 구해요`이다.
- 장식은 잎·버섯·발자국 SVG이며 스크린 리더 및 포커스 대상에서 제외한다. 게임 이미지·저장 키를 바꾸지 않는다.

## Implementation

### I01. 글꼴 파일과 공통 CSS 토큰

- Related Files:
  - `public/assets/fonts/NanumPenScript-Regular.ttf` :: Google Fonts의 Nanum Pen Script Regular TTF 복사; new
  - `public/assets/fonts/OFL.txt` :: 같은 폰트 디렉터리의 SIL Open Font License 원문 복사; new
  - `src/styles/tokens.css` :: `:root` 색상·그림자·반경·타이포 토큰 보강; modify
  - `src/styles/global.css` :: `@font-face`, `body`, 헤더, 공통 버튼/포커스 스타일; modify
  - `src/styles/responsive.css` :: 작은 화면/낮은 가로 화면의 헤더 글꼴 크기와 여백; modify

#### Details

- **Signatures & Types**: CSS `@font-face { font-family: 'Nanum Pen Script'; src: url('/assets/fonts/NanumPenScript-Regular.ttf') format('truetype'); font-style: normal; font-weight: 400; font-display: swap; }`. `font-family` fallback은 `Malgun Gothic`, `Apple SD Gothic Neo`, `system-ui`, `sans-serif` 순서.
- **Data & Schema Fields**: 기존 `--color-ink`, `--color-muted`, `--color-paper`, `--color-panel`, `--color-border`, `--color-gold`, `--color-success`, `--color-warning`, `--color-danger`, `--color-focus`, `--shadow-panel`, `--radius-panel` 이름은 유지하여 기존 CSS 의존을 깨지 않는다. 새 `--color-mint`, `--color-strawberry`, `--color-leaf`, `--shadow-sticker`, `--font-ui`를 추가한다. 크림 종이와 진한 초록 글씨, 민트 면, 작은 딸기색 강조를 일관되게 쓴다.
- **Execution Flow / Logic**:
  1. Google Fonts 공식 저장소 `ofl/nanumpenscript/NanumPenScript-Regular.ttf`와 `ofl/nanumpenscript/OFL.txt`를 같은 버전으로 받아 `public/assets/fonts/`에 둔다. 출처 및 OFL 여부를 확인하고 폰트 파일을 Git에 포함한다.
  2. `global.css`에서 `@font-face`가 사용되도록 로컬 경로를 선언한다. `body`, `button`에 `--font-ui`를 적용하고 본문 최소 20px, 보조 문구 최소 18px을 기준으로 하며 손글씨의 짧은 x-height를 고려해 `line-height`를 1.3 이상으로 둔다. 단계 카드/HUD 세부 크기는 후속 작업에서 조정한다.
  3. 헤더는 종이 패널/잎 포인트/부드러운 그림자로 디자인한다. 기존 `body > #root > main > header` 선택자와 `responsive.css`의 모바일/낮은 가로 화면 규칙을 함께 조정한다. 부제를 `display:none`으로 숨기던 낮은 가로 화면 규칙을 그대로 둘지 헤더 높이를 줄일지 화면 공간을 보고 결정하되 제목은 항상 표시한다.
  4. 색만으로 상태를 구분하지 않도록 공통 `:focus-visible` 테두리와 텍스트 대비를 보존한다. 애니메이션을 추가한다면 `prefers-reduced-motion`을 존중한다.
- **Error & Exception Handling**: 폰트 로드 실패 때 시스템 한글 글꼴로 자연스럽게 표시된다. 외부 런타임 네트워크에 의존하지 않는다.
- **State Transition & Return**: CSS와 정적 자산만 바뀌며 게임 상태/저장 데이터 구조는 변하지 않는다.

### I02. 제목과 재사용 장식

- Related Files:
  - `src/App.tsx` :: `App` 헤더 표시 문구; modify
  - `index.html` :: `<title>`과 description; modify
  - `src/components/Decorations/StickerIcon.tsx` :: 재사용 SVG 장식; new
  - `src/App.test.tsx` :: 기존 헤더 제목 기대값만 새 제목으로 갱신; modify

#### Details

- **Signatures & Types**: `type StickerKind = 'leaf' | 'mushroom' | 'footprint'`; `interface StickerIconProps { kind: StickerKind; className?: string }`; `export function StickerIcon({ kind, className }: StickerIconProps): JSX.Element` 형태의 React SVG 컴포넌트. 프로젝트의 React 19 타입 설정상 `JSX.Element`가 맞지 않으면 반환형 추론을 사용한다.
- **Data & Schema Fields**: `StickerIcon`에 영속 필드는 없다. 모든 SVG는 `viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`, `fill="none"`과 적절한 `currentColor`/내부 색을 사용한다. 잎은 잎 몸통+줄기, 버섯은 둥근 갓+기둥+작은 점, 발자국은 발바닥+작은 발가락으로 구별되게 한다.
- **Execution Flow / Logic**:
  1. `App`의 표시 h1을 정확히 `동물 구출 대작전`, 부제 p를 정확히 `알록달록한 미로를 지나 친구들을 구해요`로 바꾼다. 헤더에 장식을 넣더라도 접근성 트리에는 장식 텍스트를 노출하지 않는다.
  2. `index.html`의 `<title>`을 동일 제목으로 변경하고 description은 `동물 친구들을 구출하고 탈출구를 찾는 알록달록 미로 탐험 게임`처럼 게임 목표가 드러나게 정리한다.
  3. `StickerIcon`은 세 도형을 단일 컴포넌트에서 `kind`로 분기한다. 이미지 파일이나 이모지로 대체하지 않는다. CSS 색/크기를 부모에서 조절할 수 있게 한다.
  4. `App.test.tsx`의 이전 제목 assertion만 새 제목으로 바꾼다. 단계 시작, appearance 저장, 세션 복원 관련 assertion과 `APPEARANCE_KEY` 값은 보존한다.
- **Error & Exception Handling**: 잘못된 `kind`는 TypeScript union으로 막는다. 장식 표시 실패가 기능 버튼/제목을 가리지 않게 한다.
- **State Transition & Return**: `App`의 세션 분기, stage 생성, 저장 흐름은 그대로다.

## Acceptance Criteria

- [ ] 로컬 폰트와 OFL 문서가 번들에 포함되고 오프라인에서도 손글씨 글꼴이 적용된다.
- [ ] 헤더와 브라우저 탭에 결정된 제목이 표시되고 부제가 읽힌다.
- [ ] 글씨·포커스 대비가 충분하며 모바일/낮은 가로 화면에서 헤더가 게임을 밀어내지 않는다.
- [ ] 장식 SVG는 접근성 이름과 포커스를 만들지 않는다.
- [ ] 게임/저장 동작이 바뀌지 않는다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx` — 새 제목과 기존 세션 흐름 확인.
- `npm.cmd run build` — 폰트/장식 경로 및 타입 빌드 확인.
- 브라우저에서 데스크톱과 좁은 모바일 화면을 열어 글꼴 네트워크 경로, 탭 제목, 글씨 가독성 확인.

## Commit Message

```text
fix(maze): 동물 구출 대작전 글꼴과 공통 디자인 적용

Plan: 2026-10-01-cute-game-web-ui
Phase: P01-storybook-ui
Task: T01-identity-foundation

- 로컬 손글씨 글꼴과 라이선스, 공통 색상 토큰 추가
- 게임 제목과 부제, 재사용 SVG 장식 적용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (App 테스트 7개, 빌드, 데스크톱·모바일·낮은 가로 화면 렌더링)
- commit: Git 기록 참조
