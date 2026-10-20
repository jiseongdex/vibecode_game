# Task: T01 탐험가 선택기를 단계 선택으로 이동

## Status: done

## Goal
탐험가 외형을 단계 선택 화면에서만 바꿀 수 있게 하고, 선택한 외형은 게임과 새로고침 뒤에도 유지한다.

## Decision Summary
- `CampaignScreen`이 유일하게 `PlayerAppearancePicker`를 렌더링한다.
- `App`은 기존 `appearance` 상태, `chooseAppearance`, 로컬 저장 키를 유지한다.
- `GameScreen`은 현재 외형을 표시만 한다. 게임 상태 및 저장 스키마 변경은 없다.

## Implementation

### I01. 선택기를 단계 선택 화면에 넣기
- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreen`, `CampaignScreenProps`; modify
  - `src/components/Player/PlayerAppearancePicker.tsx` :: `PlayerAppearancePicker`; read-only

#### Details
- `CampaignScreenProps`에 필수 `appearance: PlayerAppearance`와 `onAppearanceChange: (appearance: PlayerAppearance) => void`를 추가한다. `PlayerAppearance`는 `src/assets/assetManifest.ts`의 `'girl' | 'boy'` 타입이다.
- `PlayerAppearancePicker`를 import해 단계 선택 제목과 설명 아래, 단계 버튼 grid 앞에 렌더링한다. `value={appearance}`, `onChange={onAppearanceChange}`를 전달한다.
- 단계 해금, 기록, `onStartSession` 호출은 변경하지 않는다.

### I02. App의 공통 선택기 제거 및 값 전달
- Related Files:
  - `src/App.tsx` :: `App`; modify

#### Details
- `App`의 `header` 다음에 항상 렌더링하던 `PlayerAppearancePicker` import와 요소를 제거한다.
- `session === null`일 때 렌더링하는 `CampaignScreen`에 `appearance={appearance}`, `onAppearanceChange={chooseAppearance}`를 전달한다.
- `session !== null`의 `GameScreen`에는 기존 `appearance={appearance}`를 유지한다. `chooseAppearance`의 상태 갱신과 로컬 저장은 유지한다.

### I03. 화면 범위와 저장 동작 검증
- Related Files:
  - `src/App.test.tsx` :: explorer choice test; modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: `CampaignScreen` props/tests; modify

#### Details
- `App` 테스트는 단계 선택에서 남자 탐험가를 선택하고 게임을 시작한 뒤 선택 버튼이 보이지 않으며 게임 플레이어 이미지가 남자 탐험가인지 검사한다. 저장 키에 `boy`가 기록되고 새로고침 후 단계 선택 화면에서 남자 탐험가가 선택된 상태인지 검사한다.
- `CampaignScreen`의 기존 렌더 호출에 필수 외형/변경 함수를 전달한다. 단계 선택에서 외형 변경 콜백 호출을 검사한다.
- 게임을 버리고 단계 선택으로 돌아왔을 때 선택 버튼이 다시 나타나는 기존 App 흐름을 검사한다.
- 기존 App의 세션 복구 테스트가 예전 부모 셀의 `data-row`를 읽는 오류를 현재 플레이어 스프라이트의 `data-grid-row`·`data-grid-col` 검사로 바로잡는다.

## Acceptance Criteria
- [x] 단계 선택 화면에만 여자·남자 탐험가 선택 버튼이 나타난다.
- [x] 게임 준비·플레이·일시정지·결과 화면에서 외형을 바꿀 수 없다.
- [x] 선택한 외형으로 게임이 시작되고 저장·재방문 후에도 유지된다.
- [x] 단계 시작/해금/기록 동작은 유지된다.

## Validation
- `npm.cmd test -- --run src/App.test.tsx src/components/Campaign/CampaignScreen.test.tsx` — 화면 범위·외형 저장·단계 선택 테스트 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 탐험가 설정을 단계 선택에만 표시

Plan: 2026-10-01-campaign-only-appearance
Phase: P01-campaign-picker
Task: T01-move-appearance-picker-to-campaign

- 탐험가 선택기를 단계 선택 화면으로 이동
- 게임 화면에서 외형 변경 UI 제거
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
