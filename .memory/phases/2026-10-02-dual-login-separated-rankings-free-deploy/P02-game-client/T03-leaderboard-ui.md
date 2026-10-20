# Task: T03 분리 랭킹 화면

## Status: done

## Goal

단계 선택 화면에서 자신의 로그인 유형에 해당하는 전체 기간 랭킹을 열고, 최고 완료 단계·그 단계의 최단 시간·내 순위를 읽기 쉽게 보여준다.

## Decision Summary

- 서버 `GET /api/leaderboard`가 인증 유형별로 행을 분리한다. 클라이언트에서 유형 query를 지정하거나 다른 유형 목록을 합치지 않는다.
- 상위 100명과 내 항목을 제공하고, 최고 단계 우선·같은 단계에서 시간 우선이다. 시간 표시는 기존 `formatTime`을 쓴다.

## Implementation

### I01. 랭킹 조회 상태와 표시

- Related Files:
  - `src/components/Leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel` — 목록·내 순위·로딩/빈/오류 상태; new
  - `src/components/Leaderboard/LeaderboardPanel.module.css` :: ranking styles — 모바일 가로 스크롤 없이 긴 이름 처리; new
  - `src/components/Leaderboard/LeaderboardPanel.test.tsx` :: panel tests — 정렬 표시·중복·빈 목록·오류; new
  - `src/components/Hud/GameHud.tsx` :: `formatTime` — 기존 `mm:ss` helper 사용; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  function LeaderboardPanel(props: { authType: AuthType; currentUserId: string; onBack: () => void }): ReactElement
  ```
- **Data & Schema Fields**: `LeaderboardDto.top`의 각 행은 순위·표시 이름·최고 단계·`formatTime(bestTimeSeconds)`를 보여준다. `current`가 null이면 `아직 완료한 단계가 없어 순위가 없습니다` 메시지를 보여준다. `current`가 top 안에 있으면 해당 행을 강조하고 별도 중복 행을 만들지 않는다. top 밖이면 분리된 `내 순위` 행으로 표시한다.
- **Execution Flow / Logic**:
  1. 패널을 열 때 `getLeaderboard()`를 호출한다. 로딩 중에는 이전 유형의 목록을 재사용하지 않고 로딩 상태를 보여준다.
  2. 네트워크/5xx에는 재시도 버튼을 보여주며, 401은 상위 App의 세션 재조회로 넘겨 게임과 랭킹을 닫는다. 유형은 `SessionDto.user.authType`에서만 제목에 사용한다.
  3. `authType='microsoft'`이면 `Microsoft 랭킹`, `simple`이면 `간편 계정 랭킹`으로 제목을 구분한다. Microsoft 표시 이름은 실명일 수 있음을 화면에 짧게 알린다.
  4. 서버 DTO의 순서와 rank를 그대로 표시하고 프런트에서 독립적으로 정렬·재집계하지 않는다. React 텍스트 렌더링으로 사용자 이름을 안전하게 표시한다.

### I02. 단계 선택에서 진입·복귀

- Related Files:
  - `src/components/Campaign/CampaignScreen.tsx` :: `CampaignScreenProps`, `CampaignScreen` — `랭킹 보기` 버튼과 `onShowLeaderboard`; modify
  - `src/components/Campaign/CampaignScreen.test.tsx` :: campaign navigation tests — 버튼과 단계 선택 복귀; modify
  - `src/App.tsx` :: `AuthenticatedGame` — campaign/ranking 보기 상태 전환; modify
  - `src/App.test.tsx` :: ranking route tests — 유형별 제목, 비로그인 차단, 복귀; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface CampaignScreenProps { onShowLeaderboard: () => void /* T02의 다른 props 유지 */ }
  type CampaignView = 'stages' | 'leaderboard'
  ```
- **Execution Flow / Logic**: 게임 진행 중에는 단계 선택·랭킹 버튼을 끼워 넣지 않는다. 게임에서 캠페인으로 돌아온 뒤 `랭킹 보기`를 누르면 새 조회를 수행하고, `단계 선택으로 돌아가기`는 게임 진행 상태를 바꾸지 않는다. 로그아웃 또는 auth type 변경 시 이전 목록과 보기 상태를 지운다.

## Acceptance Criteria

- [x] Microsoft 사용자와 간편 사용자는 서로 다른 제목과 서버가 분리한 목록을 본다.
- [x] 상위 100명 안의 내 행은 강조되고, 목록 밖의 내 순위는 별도로 표시된다.
- [x] 최고 단계와 `mm:ss` 최단 시간, 공동 순위를 읽을 수 있다.
- [x] 비로그인·다른 유형 세션에서는 패널이 열리지 않는다.

## Validation

- `npm.cmd test -- --run src/components/Leaderboard/LeaderboardPanel.test.tsx src/components/Campaign/CampaignScreen.test.tsx src/App.test.tsx` — 표시·진입·세션 경계 통과
- `npm.cmd test -- --run` — 기존 게임·Worker 테스트 회귀 확인
- `npm.cmd run lint` — 타입 검사 통과
- `npm.cmd run build` — 프로덕션 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(ui): 로그인 유형별 랭킹 화면 제공

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P02-game-client
Task: T03-leaderboard-ui

- 상위 100명과 내 최고 단계·시간 순위 표시
- 일치하는 로그인 경로에서만 랭킹 접근 허용
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `9156a98`
