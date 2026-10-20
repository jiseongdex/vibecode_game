# Decisions: 시작 안내 문구 손글씨와 크기 조정

- Date: 2026-10-02
- Status: Confirmed
- Supersedes: [기존 시작 연출 결정](./2026-10-02-random-animal-cute-game-intro.md)의 D02 중 시작 안내 문구 글꼴·크기에 관한 부분만 수정한다.

## D01. 안내 순서와 시간

- **Chosen**: 단계 진입 때 `동물을 구출해서 탈출해줘!`를 먼저 약 3초 표시하고, 이어 `3 → 2 → 1`을 각각 약 1초 표시한 후 자동 시작한다. 재도전은 기존처럼 숫자만 표시한다.
- **Rationale**: 사용자가 기존 순서 유지를 선택했다. 이번 변경은 순서나 시작 시각이 아니라 시각 표현에 한정된다.
- **Code basis**: `GameScreen`의 `IntroStep`이 `message → 3 → 2 → 1`을 진행한다.

## D02. 손글씨 글꼴

- **Chosen**: 안내 문구에 기존 로컬 웹폰트 `Nanum Pen Script`를 적용한다. 카운트다운 숫자와 다른 안내·알림의 주아(Jua) 글꼴은 유지한다.
- **Rationale**: 사용자가 안내 문구를 손글씨 느낌으로 바꾸길 요청했다. 이미 `public/assets/fonts/NanumPenScript-Regular.ttf`와 `@font-face`가 있어 새 폰트 자산은 필요 없다.
- **Code basis**: `src/styles/tokens.css`의 `--font-ui`가 Nanum Pen Script를, `--font-message`가 Jua를 사용한다. `GameScreen.module.css`의 `.introMessage`와 `.introNumber`가 현재 공통으로 `--font-message`를 사용하므로 문구 규칙만 분리한다.

## D03. 미로 안쪽 중앙의 작은 표시

- **Chosen**: 안내 문구와 카운트다운 숫자를 모두 지금보다 작게 줄이고, 기존 미로 틀 내부 중앙 정렬은 유지한다. 구현 기준 크기는 문구 `clamp(22px, 3vw, 36px)`, 숫자 `clamp(48px, 8vw, 82px)`로 시작해 작은 화면에서도 읽히게 한다.
- **Rationale**: 사용자가 문구와 숫자 모두 너무 크다고 확인했다. 현재 최대 크기 58px·164px를 낮추되 화면 폭에 따라 조정한다.
- **Code basis**: `.introOverlay`는 이미 `inset: var(--frame-border)`와 `display: grid; place-items: center`로 테두리 안쪽에 중앙 배치된다. 미로 내부의 반투명 가림막과 게임 입력 차단은 유지한다.

## 범위와 확인 사항

- 사용자 확정: 안내 문구는 카운트다운 전, 문구와 숫자 모두 축소.
- 코드에서 확인: 손글씨 폰트는 로컬 자산으로 등록됨; 기존 오버레이는 미로 틀 안쪽 중앙에 배치됨; 재도전은 숫자만 표시됨.
- 구현 전 확인할 것: 데스크톱과 모바일에서 문구가 미로 프레임 안에 들어가며 시각적으로 작아졌는지, 자동 시작 시간이 바뀌지 않았는지.
