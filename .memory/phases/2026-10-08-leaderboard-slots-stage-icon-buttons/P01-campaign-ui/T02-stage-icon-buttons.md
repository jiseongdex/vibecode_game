# Task: T02 그림 위 단계 글자 버튼

## Status: done

## Goal

단계 선택의 사각형 칸을 기존 버섯·발자국·나뭇잎 그림 위에 단계 숫자와 `단계` 글자만 있는 버튼으로 바꾼다. 잠긴 그림은 회색이며 실행 불가 상태를 유지한다.

## Decision Summary

- D04: 기존 `StickerIcon` SVG 종류와 단계별 반복 순서, 단계 선택·해금 로직, `aria-label`은 유지한다.
- D05: 1440×900 무스크롤, 낮은 데스크톱 좌우 배치, 320px 모바일 탭·접근성을 검증한다.

## Implementation

### I01. 그림 버튼 마크업과 상태

- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreen`의 단계 `button` JSX — SVG를 큰 그림 배경으로 쓰고 화면 문자 `N단계`만 남긴다; modify
  - `src/components/Decorations/StickerIcon.tsx` :: `StickerIcon` — 기존 `kind`와 SVG 경로만 읽고 가능하면 수정하지 않는다; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface CampaignScreenProps {
    progress: CampaignProgress
    appearance: PlayerAppearance
    onAppearanceChange: (appearance: PlayerAppearance) => void
    onStartStage: (stage: number) => Promise<void>
  }
  ```
- **Data & Schema Fields**: `CampaignProgress.unlockedStage: number`, `stageRecords: Record<number, { bestTimeSeconds: number }>` 유지. 단계별 `record`·`locked` 계산, `routePosition` 그리드 속성, `startingStage` 비동기 잠금은 유지한다.
- **Execution Flow / Logic**: 기존 `StickerIcon` 종류 선택(`stage % 3`)과 `disabled={locked || startingStage !== null}`를 그대로 사용한다. 시각적 보조 문구 `잠김`, `시작하기`, `준비 중…`, `최고 mm:ss`는 버튼 안에서 렌더링하지 않는다. 접근 가능한 `aria-label`은 단계·잠김·완료·도전 가능 상태를 유지한다. `formatTime` 미사용 import를 제거한다.

### I02. 사각형 제거와 회색 SVG

- Related Files:
  - `src/components/Campaign/CampaignScreen.module.css` :: `.stage`, `.stageIcon`, `.stage strong`, `.stage:disabled`, 반응형 규칙 — 버튼 상자 배경·테두리·그림자 제거, 큰 SVG와 글자 겹치기, 잠금 회색; modify
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: `.row`, `.myRecord h3`, `.pagination` — T01의 10칸 실제 화면 확인에서 작은 필기체 글자가 읽기 어려운 문제를 발견해 데이터 글꼴을 기존 `--font-message`로 바꿈; modify

#### Details

- **Execution Flow / Logic**:
  1. `.routeNode` 그리드와 연결 점선은 유지하고, `.stage`는 셀 전체의 클릭 대상이되 투명 배경·테두리 없음으로 렌더링한다.
  2. SVG는 버튼 안에서 시각적 그림으로 크게 중앙 배치한다. 단계 글자는 절대 또는 grid 겹침으로 그림 중앙에 올리고 대비를 확보한다. 그림과 글자의 pointer event는 버튼에 전달한다.
  3. 잠긴 단계는 SVG의 색·포화도를 회색으로 바꾸고 글자도 회색 계열로 표시한다. `disabled`와 `cursor:not-allowed`를 유지한다. 완료 단계는 잠금과 구분되는 색을 쓰되 사각형 배경은 만들지 않는다.
  4. hover·active·focus-visible, 901px 이상 4×5, 900px 이하 2열·320px에서 겹침과 터치 대상 크기를 확인한다. `prefers-reduced-motion` 규칙은 유지한다.
  5. 랭킹 10칸의 행·내 기록 제목·페이지 이동 글꼴을 `--font-message`로 통일해 읽기 쉽게 하되 1440×900 무스크롤과 320px 가로 무스크롤을 유지한다.

### I03. 회귀 테스트와 실제 화면 확인

- Related Files:
  - `src/components/Campaign/CampaignScreen.test.tsx` :: `CampaignScreen` 테스트 — 각 버튼의 화면 글자만 `N단계`, SVG 종류 순서, 잠금·완료·실행 동작 확인; modify
  - `src/App.test.tsx` :: 화면 통합 테스트 — 변경이 필요한 경우만 수정; modify-if-needed

#### Details

- 최고 기록 데이터는 단계 재시도 및 서버 기록에 남지만 단계 버튼의 화면 문구에서는 빠진다. 잠금 해제와 재플레이 테스트를 유지하고, `aria-label`의 상태 정보가 남는지 확인한다. 실제 브라우저에서 1440×900, 1213×600, 320px 화면의 그림·글자·스크롤·좌우 패널과 모바일 탭을 점검한다.

## Acceptance Criteria

- [x] 20개 단계 버튼은 버섯·발자국·나뭇잎 그림과 `N단계`만 화면에 보인다.
- [x] 사각형 칸 배경·테두리가 없고 잠긴 그림은 회색이며 클릭할 수 없다.
- [x] 완료·해금·재플레이 동작과 상태 `aria-label`은 유지된다.
- [x] 1440×900 무스크롤, 낮은 데스크톱 좌우 배치, 320px 모바일 탭과 가로 무스크롤을 유지한다.

## Validation

- `npm.cmd test -- --run src/components/Campaign/CampaignScreen.test.tsx src/components/Leaderboard/LeaderboardPanel.test.tsx src/App.test.tsx` — 단계·랭킹 회귀
- `npm.cmd run lint` — 타입 검사
- `npm.cmd run build` — 스타일 포함 번들 검사
- `git diff --check` — 공백 오류 없음
- 실제 브라우저 1440×900, 1213×600, 320px 확인 — 그림 버튼·잠금·내 기록·순위 칸·페이지·스크롤

## Commit Message

```text
style(campaign): 스티커 버튼에 단계 이름 배치

Plan: 2026-10-08-leaderboard-slots-stage-icon-buttons
Phase: P01-campaign-ui
Task: T02-stage-icon-buttons

- 직사각형 단계 타일을 큰 스티커 아이콘으로 교체
- 잠긴 단계는 회색으로 표시하고 접근 차단
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `d2fd939`
