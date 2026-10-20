# Task: T09 반응형·접근성·전체 검증

## Status: done

## Goal
데스크톱과 모바일 화면에서 조작 가능한지 확인하고, 핵심 게임 시나리오·빌드·린트·저장 복귀를 최종 검증한다.

## Decision Summary
- 키보드와 화면 방향 버튼을 모두 제공한다.
- 모바일·데스크톱을 지원하며, 미니맵 없이 캐릭터 중심으로 탐색한다.

## Implementation

### I01. 반응형 및 접근성 보완
- Related Files:
  - `src/styles/responsive.css` :: 모바일/데스크톱 breakpoint; new
  - `src/components/GameScreen/GameScreen.module.css` :: 작은 화면 레이아웃; modify
  - `src/components/Controls/DirectionControls.module.css` :: 터치 타깃 크기; modify
  - `src/components/Hud/GameHud.tsx` :: live region 및 의미론적 레이블; modify

#### Details
- 게임 보드는 뷰포트에 맞춰 셀 크기를 계산하고 방향 버튼은 최소 44×44px 터치 영역을 보장한다.
- HUD의 시간과 구출 진행도는 `aria-live="polite"`로 업데이트한다.
- 색상만으로 상태를 구분하지 않고 텍스트/아이콘을 함께 표시한다.
- `prefers-reduced-motion`과 세로/가로 화면 모두에서 레이아웃이 깨지지 않도록 한다.

### I02. 전체 시나리오 테스트
- Related Files:
  - `src/game/integration.test.tsx` :: 시작부터 클리어까지 통합 테스트; new
  - `README.md` :: 실행·테스트·게임 규칙 문서; modify

#### Details
- 새 게임 생성 → 이동 → 대상 전원 구조 → 탈출구 도착 → 단계 해금 시나리오를 검증한다.
- 시간 초과 → 같은 미로 retry 및 새 미로 restart 시나리오를 검증한다.
- 저장 → 앱 재마운트 → 일시정지 복구 → Resume 시나리오를 검증한다.
- 단계 20 완료와 최고 기록 병합을 검증한다.

## Acceptance Criteria
- [x] 모바일 폭과 데스크톱 폭에서 보드와 조작 버튼이 겹치지 않는다. (사용자 화면 확인)
- [x] 핵심 컨트롤과 상태에 키보드 조작 및 스크린 리더 레이블을 제공한다.
- [x] 전체 테스트, 린트, 빌드가 통과한다.
- [x] README에 실행 방법과 게임 규칙이 기록된다.

## Validation
- `npm test -- --run`
- `npm run lint`
- `npm run build`
- 브라우저 수동 검증: 1단계 클리어, 시간 초과, 새로고침 복구, 모바일 버튼 조작, 20단계 선택 잠금

## Commit Message
```text
feat(game) : 반응형 게임플레이와 저장 복귀 검증 완료

Plan: 2026-09-29-maze-rescue-game
Phase: P03-persistence-assets-validation
Task: T09-validation-and-polish

- 시작부터 탈출까지의 통합 시나리오와 저장 복귀 검증 추가
- 반응형 화면·접근성 보완 및 실행 방법 문서화
```

## Progress
- [x] 구현 완료
- [x] 자동 검증 통과 (`npm test -- --run`: 71개, `npm run lint`, `npm run build`)
- [x] 브라우저 동작 사용자 확인 (에이전트의 독립적인 화면 검증은 불가)
- commit: 완료 (Git 기록의 `Task: T09-validation-and-polish` 참조)
