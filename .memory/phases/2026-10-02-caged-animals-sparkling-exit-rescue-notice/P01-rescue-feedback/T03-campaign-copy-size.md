# Task: T03 단계 선택 문구 크기와 오타

## Status: done

## Goal

단계 선택 화면의 두 설명 문구를 읽기 편한 작은 크기로 줄이고 첫 문구의 `떠자나!` 오타를 `떠나자!`로 고친다. 제목·단계 카드·진행률·탐험가 선택 라벨은 유지한다.

## Decision Summary

- 첫 문구는 앱 상단 header `<p>`, 둘째 문구는 `CampaignScreen`의 `.intro`다. 다른 텍스트와 묶인 선택자까지 함께 줄이지 않는다.
- 두 문구는 이미 사용자 미커밋 변경으로 작업 트리에 있다. 기존 문구를 유지하고 첫 문구의 오타만 고친다. T01·T02는 이 두 파일을 스테이징하지 않는다.

## Implementation

### I01. 상단 문구 크기와 오타

- Related Files:
  - `src/App.tsx` :: `App`의 session이 없을 때 `<header><p>` — 문구 오타 수정; modify (기존 미커밋 사용자 변경 보존)
  - `src/styles/global.css` :: `body > #root > main > header p` — 상단 설명 글씨만 축소; modify
  - `src/styles/tokens.css` :: `--font-message`의 Jua 글꼴 — 기존 폰트 유지; read-only

#### Details

- **Signatures & Types**:
  ```tsx
  <p>동물들을 구하러 탐험을 떠나자!</p>
  ```
  ```css
  body > #root > main > header p { font-size: clamp(20px, 2.4vw, 24px); }
  ```
- **Data & Schema Fields**: 새 데이터 필드·저장 스키마는 없다. 기존 `session`에 따라 header를 숨기는 조건은 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 현재 작업 트리의 `src/App.tsx`는 `동물들을 구하러 탐험을 떠자나!`라는 **미커밋 사용자 변경**을 포함한다. `git diff -- src/App.tsx`로 이를 다시 확인한다.
  2. Core Processing: 문자열의 `떠자나!`만 `떠나자!`로 고친다. header의 제목과 `StickerIcon`, session 분기는 유지한다. `global.css`에서 header p의 현재 `clamp(26px, 3vw, 32px)`를 `clamp(20px, 2.4vw, 24px)`로 바꾸고 Jua, 색, 행간은 유지한다.
  3. Error Handling: 실행 시 작업 트리에 추가 사용자 수정이 생겼다면 파일 전체를 덮어쓰지 말고 해당 한 줄만 편집한다. 커밋 전 diff를 확인해 다른 사용자 변경이 끼어 있으면 그 변경을 건드리지 않거나 스테이징하지 않는다.
  4. State Transition & Return: 게임 상태·진입 방식은 그대로다. 화면 문구와 CSS만 달라진다.

### I02. 단계 선택 설명만 줄이기

- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `.intro` 문구 — 현재 사용자 변경 문자열 유지 및 이번 UI 커밋에 포함; modify/stage existing user hunk
  - `src/components/Campaign/CampaignScreen.module.css` :: `.intro`, `.progress`, `.pickerLabel`, 모바일 `@media` — `.intro`에만 작은 크기; modify

#### Details

- **Signatures & Types**:
  ```tsx
  <p className={styles.intro}>동물 친구를 구출하고 탈출구를 찾으면 다음 단계가 열려요.</p>
  ```
  ```css
  .intro { font-size: 21px; line-height: 1.3; }
  @media (max-width: 700px) { .intro { font-size: 19px; } }
  ```
- **Data & Schema Fields**: `CampaignProgress`와 단계 잠금 데이터는 그대로다.
- **Execution Flow / Logic**:
  1. Precondition: 현재 `CampaignScreen.tsx`의 위 문구는 **미커밋 사용자 변경**이다. 그대로 보존하고 다른 UI 로직을 바꾸지 않는다. `CampaignScreen.module.css`는 `.intro, .progress, .pickerLabel`에 27px, 700px 이하에서는 `.intro, .progress, .pickerLabel, .complete`에 25px를 공동 적용한다.
  2. Core Processing: 기본·모바일의 공유 크기 선택자에서 `.intro`만 분리하고 기본 21px/700px 이하 19px를 지정한다. `.intro`의 Jua 폰트와 1.3 행간을 유지한다. `.progress`·`.pickerLabel`은 27px/25px, `.complete`는 기존 값, 단계 카드 `.stage` 글자는 모두 그대로다.
  3. Commit Handling: user copy를 새 CSS와 함께 버전 관리할 때 `App.tsx`·`CampaignScreen.tsx`의 현재 두 문구 hunk도 확인해 포함한다. T01/T02가 이미 두 파일을 바꾸거나 사용자 추가 변경이 생겼다면 해당 부분을 덮어쓰지 않고 의도한 hunk만 스테이징한다.
  4. Return: 설명 두 개가 기존보다 작아지고 화면 문구는 요청한 문장 그대로다.

### I03. 문구와 회귀 확인

- Related Files:
  - `src/App.test.tsx` :: `App`의 단계 선택 문구·게임 진입 테스트 — 정확한 첫 문구와 둘째 문구 존재 확인; modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: 단계 카드·진행률 기존 회귀; read-only

#### Details

- `App.test.tsx`에서 게임 시작 전 `동물들을 구하러 탐험을 떠나자!`와 `동물 친구를 구출하고 탈출구를 찾으면 다음 단계가 열려요.`의 렌더링을 확인한다. 게임 진입 시 header가 숨겨지는 기존 동작도 유지한다.
- CSS 값과 선택자 분리를 소스에서 확인한다. jsdom은 실제 글꼴 크기·줄바꿈을 정확히 렌더링하지 않으므로 브라우저가 연결되면 데스크톱, 390×844 모바일에서 두 문구와 다른 라벨을 나란히 확인한다. 연결되지 않으면 미실시 기록.

## Acceptance Criteria

- [x] 상단 문구는 `동물들을 구하러 탐험을 떠나자!`이며 기존보다 작다.
- [x] 단계 설명은 `동물 친구를 구출하고 탈출구를 찾으면 다음 단계가 열려요.` 그대로이고 기존보다 작다.
- [x] 제목·단계 카드·진행률·탐험가 선택 라벨의 크기와 기능은 유지된다.
- [x] 기존 미커밋 사용자 문구를 보존하고 의도하지 않은 파일 변경을 커밋하지 않는다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx src/components/Campaign/CampaignScreen.test.tsx` — 문구와 단계 선택 회귀 통과.
- `npm.cmd test -- --run` — 전체 회귀 통과.
- `npm.cmd run build` — 타입 검사와 번들 통과.
- `git diff --check` — 공백 오류 없음. 브라우저 연결 시 데스크톱·390×844에서 설명 문구 줄바꿈과 다른 라벨 크기 보존 확인.

## Commit Message

```text
style(campaign): 단계 안내 문구를 작게 조정

Plan: 2026-10-02-caged-animals-sparkling-exit-rescue-notice
Phase: P01-rescue-feedback
Task: T03-campaign-copy-size

- 탐험 안내 오타를 고치고 상단 문구 크기 축소
- 단계 설명만 줄여 진행률과 카드 글자 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
