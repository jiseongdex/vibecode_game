# Task: T02 모바일 단계 선택·랭킹 탭

## Status: pending

## Goal

900px 이하 화면에서 단계 선택과 랭킹을 한 번에 한 패널씩 보는 탭으로 바꾸고, 첫 화면은 단계 선택으로 연다. 데스크톱의 좌우 동시 표시는 유지한다.

## Decision Summary

- 결정 D02·D06·D07: 모바일 기본 탭은 `단계 선택`이고 `랭킹` 탭으로 전환한다. 1440×900 노트북 무스크롤 규칙은 유지하고, 작은 모바일에서는 내용 접근을 위한 단계 스크롤을 허용한다.
- T01의 `CampaignWorkspace`는 랭킹과 단계 선택을 한 번씩 마운트한다. 탭 전환은 표시 상태만 바꾸고 API를 중복 호출하지 않는다.
- 로그인·랭킹 API·단계 진행 모델은 변경하지 않는다.

## Implementation

### I01. 탭 상태와 접근 가능한 선택 버튼

- Related Files:
  - `src/components/Campaign/CampaignWorkspace.tsx` :: `CampaignWorkspace`, `CampaignTab` — 기본 탭 상태·선택 버튼·패널 속성; modify
  - `src/components/Campaign/CampaignWorkspace.module.css` :: `.tabs`, `.tab`, `.workspace`, `.leaderboardPane`, `.stagesPane` — 모바일 단일 패널 표시; modify

#### Details

- **Signatures & Types**:
  ```typescript
  type CampaignTab = 'stages' | 'leaderboard'
  const [activeTab, setActiveTab] = useState<CampaignTab>('stages')
  // CampaignWorkspaceProps는 T01과 동일:
  // authType: AuthType; currentUserId: string; progress: CampaignProgress;
  // appearance: PlayerAppearance; onAppearanceChange: (appearance: PlayerAppearance) => void;
  // onStartStage: (stage: number) => Promise<void>;
  // onUnauthorized: () => Promise<void>.
  ```
- **Data & Schema Fields**:
  - `CampaignTab`은 컴포넌트 내부 UI 상태이며 기본값은 `'stages'`다. 서버·localStorage에 저장하지 않는다. `CampaignProgress`, `LeaderboardDto` 및 인증 DTO는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. 작업 공간 맨 앞에 `role="group" aria-label="화면 선택"` 컨테이너와 네이티브 `<button type="button">` 두 개를 추가한다. 텍스트는 `단계 선택`, `랭킹`이고 선택 상태는 `aria-pressed={activeTab === ...}`다. 클릭 시 `setActiveTab`만 호출한다. Tab/Enter/Space 기본 키 조작을 유지한다.
  2. 작업 공간 루트에 `data-active-tab={activeTab}`을 둔다. 데스크톱에서는 `.tabs { display: none }`, 두 패널은 1:1 그리드로 보인다. `@media (max-width: 900px)`에서 탭을 보이고 한 열로 만든다. `data-active-tab='stages'`에서는 `.leaderboardPane`, `'leaderboard'`에서는 `.stagesPane`에 `display: none`을 적용한다. 숨긴 패널은 키보드 포커스와 접근성 트리에서도 제외한다.
  3. 모바일 단계 패널은 높이 제한·내부 스크롤을 풀어 기존 2열×10행 단계를 페이지 흐름으로 보여준다. 랭킹 패널은 이 Task 동안 `max-height: min(75dvh, 780px)`와 `overflow-y: auto`로 100명 목록을 접근 가능하게 한다. 다음 T04의 10명 페이지네이션이 들어오면 랭킹 내부 스크롤을 제거한다. 320px 폭에서 탭 버튼과 단계 버튼이 잘리지 않게 기존 좁은 화면 글자 축소 규칙을 확인한다.
  4. 패널은 탭 전환 때 언마운트하지 않는다. `LeaderboardPanel`의 로딩/오류/재시도 상태를 유지하고, 탭 클릭만으로 `getLeaderboard()`를 재호출하지 않는다. 게임 시작 때 작업 공간이 언마운트되고 게임에서 돌아와 재마운트되면 기본 `stages`와 새 랭킹 조회가 적용된다.

### I02. 탭 동작 회귀 검증

- Related Files:
  - `src/App.test.tsx` :: `App authentication and account game` — 기본 탭·전환·랭킹 호출 횟수·게임 복귀; modify

#### Details

- **Test Scenarios**:
  1. `/simple` 로그인 직후 `화면 선택` 그룹의 `단계 선택` 버튼은 `aria-pressed="true"`, `랭킹` 버튼은 `false`이고 작업 공간 `data-active-tab="stages"`다.
  2. `랭킹` 버튼 클릭 시 두 속성이 반대로 바뀌고, 다시 `단계 선택`을 누르면 복귀한다. 탭 전환만으로 `getLeaderboard()` 호출 횟수는 변하지 않는다.
  3. 게임을 시작하면 탭/패널이 게임 화면으로 교체된다. 게임에서 단계 선택으로 돌아오면 기본 탭과 랭킹 재조회가 확인된다.
  4. JSDOM은 실제 CSS 미디어 쿼리 표시를 검증하지 못하므로 테스트는 상태·접근성 속성을 검증한다. 실행 시 브라우저 320px, 900px, 901px 폭에서 표시·스크롤·키보드 포커스를 수동 확인한다.

## Acceptance Criteria

- [ ] 900px 이하에서는 단계 선택이 기본으로 보이고 탭에 따라 한 패널만 보인다.
- [ ] 900px 초과에서는 탭이 숨겨지고 랭킹 왼쪽·단계 오른쪽이 함께 보인다.
- [ ] 탭 전환은 랭킹을 재조회하지 않으며 게임 복귀는 새 랭킹을 조회한다.
- [ ] 320px 폭에서 텍스트·버튼이 잘리지 않고 키보드로 탭을 조작할 수 있다.

## Validation

- `npm.cmd test -- --run src/App.test.tsx` — 기본 탭·전환·랭킹 호출·게임 복귀 검증
- `npm.cmd run lint` — TypeScript 검사 통과
- `npm.cmd run build` — 반응형 스타일 포함 빌드 통과
- `git diff --check` — 공백 오류 없음
- 수동 브라우저 확인: 320px, 900px, 901px 폭의 표시·스크롤·포커스 — CSS 동작 확인

## Commit Message

```text
feat(campaign): add mobile stages and ranking tabs

Plan: 2026-10-06-campaign-leaderboard-split
Phase: P01-campaign-layout
Task: T02-mobile-tabs

- Default mobile view to stage selection
- Preserve desktop split and ranking fetch across tab changes
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## Commit Isolation

커밋에는 이 Task의 `CampaignWorkspace` 소스·스타일, `App.test.tsx`, 해당 Task 메모만 지정한다. 이미 스테이징된 배포 파일 네 개는 포함하지 않고 커밋 직전 포함 파일 목록을 확인한다.
