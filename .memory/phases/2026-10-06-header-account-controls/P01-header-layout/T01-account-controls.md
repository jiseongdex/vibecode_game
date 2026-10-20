# Task: T01 타이틀 하단 사용자 정보 배치

## Status: done

## Goal

로그인 후 단계 선택·랭킹 화면의 `동물 구출 대작전` 헤더 하단 오른쪽에 계정 표시 이름과 로그아웃 버튼만 보이게 한다. 기존 상단 계정 카드와 진행 새로고침 UI를 제거한다.

## Decision Summary

- `.memory/decisions/2026-10-06-header-account-controls.md` D01~D04에 따라 `SessionDto.user.displayName`을 닉네임 자리에 쓴다.
- 실제 플레이 중에는 기존처럼 헤더가 숨겨지므로 사용자 정보도 숨긴다. 진행 중인 P03 배포 변경은 수정·커밋하지 않는다.

## Implementation

### I01. 헤더 JSX와 불필요한 상태 정리

- Related Files:
  - `src/App.tsx` :: `AuthenticatedGame` — 계정 UI를 `<header>` 안으로 옮기고 수동 진행 새로고침 UI 전용 상태·함수를 제거; modify
  - `src/hooks/usePersistedGame.ts` :: `refreshProgress` — 다른 사용처와 단위 테스트가 있으므로 변경하지 않음; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  function AuthenticatedGame({ account, onSignOut, onRefreshAuth }: {
    account: SessionDto
    onSignOut: () => Promise<void>
    onRefreshAuth: () => Promise<void>
  }): ReactElement
  ```
- **Data & Schema Fields**:
  - `SessionDto.user.displayName: string` — 화면 표시 이름. 별도 `nickname` 필드는 없고 nullable이 아니다.
  - `session: ActiveSession | null` — `null`일 때만 타이틀 헤더를 렌더링한다.
- **Execution Flow / Logic**:
  1. `<main>` 시작 부분의 별도 `.account-toolbar`와 `syncError` 알림을 제거한다.
  2. `!session` 분기의 헤더에서 기존 `h1`, 소개 문구를 유지하고 그 아래 `.account-toolbar`를 추가한다. 내부에는 `<span>{account.user.displayName}</span>`와 기존 `onSignOut` 호출 버튼만 둔다.
  3. `syncError`, `syncing` 상태, `refreshProgress` 구조 분해, `syncFromServer` 함수와 새로고침 버튼을 삭제한다. 무단 접근 시 `onRefreshAuth`를 쓰는 다른 오류 처리, `retryResult`, 시작/완료 흐름은 유지한다.
  4. 로그아웃 Promise는 기존처럼 `void onSignOut()`으로 호출한다. 헤더는 세션이 있으면 렌더링하지 않는다.

### I02. 헤더 내 정렬과 좁은 화면 처리

- Related Files:
  - `src/styles/global.css` :: `body > #root > main > header`, `.account-toolbar` — 헤더 내부 오른쪽 정렬 및 긴 이름 줄바꿈; modify
  - `src/styles/responsive.css` :: header media rules — 기존 제목 크기·가로 화면 문구 숨김을 유지; read-only

#### Details

- 별도 카드 공통 규칙에서 `.account-toolbar`를 제거하고 `.account-pending`, `.auth-gate` 규칙은 유지한다.
- `.account-toolbar`는 헤더 안에서 `display:flex`, `justify-content:flex-end`, `align-items:center`, `flex-wrap:wrap`로 배치한다. 이름은 긴 표시 이름이 좁은 화면에서 넘치지 않도록 `overflow-wrap:anywhere`, 버튼은 `flex:none`을 사용한다.
- 기존 계정 버튼의 색상·테두리·최소 높이를 유지하고 `.account-toolbar button:disabled` 규칙은 사용처가 없어 제거한다. 헤더 제목과 소개 문구의 가운데 정렬은 유지한다.

### I03. 사용자 관점 회귀 확인

- Related Files:
  - `src/App.test.tsx` :: `App authentication and account game` — 기존 수동 새로고침 테스트를 새 헤더 구조·표시 항목 테스트로 교체; modify

#### Details

- `/simple`의 인증된 화면에서 `header` 안에 표시 이름 `테스터`와 `로그아웃` 버튼이 있고 `진행 새로고침` 버튼이 없음을 확인한다. 헤더 바깥에 동일한 이름이나 로그아웃 버튼이 중복되지 않아야 한다.
- 기존 로그인 관문, 단계 시작, 랭킹 테스트는 그대로 통과해야 한다.

## Acceptance Criteria

- [ ] 타이틀 헤더 하단 오른쪽에 표시 이름과 로그아웃 버튼만 있다.
- [ ] 별도 상단 계정 카드와 `진행 새로고침` 버튼이 없다.
- [ ] 320px 이상의 좁은 화면에서도 이름과 버튼이 헤더 안에서 줄바꿈된다.
- [ ] 로그아웃·단계 선택·랭킹 흐름이 유지된다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx` — App 인증 및 계정 화면 테스트 통과
- `npm.cmd run lint` — TypeScript 검증 통과
- `npm.cmd run build` — 프로덕션 빌드 통과

## Commit Message

```text
feat(ui): 제목 영역에 계정 메뉴 배치

Plan: 2026-10-06-header-account-controls
Phase: P01-header-layout
Task: T01-account-controls

- 제목 오른쪽 아래에 표시 이름과 로그아웃 메뉴 배치
- 수동 진행 기록 새로고침 버튼 제거
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (`npm.cmd test -- --run src/App.test.tsx`: 12 tests, `npm.cmd run lint`, `npm.cmd run build`)
- commit: `7c18cdb`
