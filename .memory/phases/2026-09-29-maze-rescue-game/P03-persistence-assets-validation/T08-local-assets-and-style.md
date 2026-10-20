# Task: T08 로컬 에셋과 판타지 스타일

## Status: done

## Goal
AI 생성 로컬 에셋을 게임에 연결하고, 밝고 친근한 판타지 탐험 분위기의 색상·타이포그래피·상태 표현을 완성한다.

## Decision Summary
- 캐릭터·구출 대상·탈출구·환경 에셋은 프로젝트 내부 파일로 포함한다.
- 외부 CDN이나 런타임 원격 이미지 URL에 의존하지 않는다.

## Implementation

### I01. 에셋 구성
- Related Files:
  - `public/assets/player-girl.png`, `public/assets/player-boy.png` :: 선택 가능한 탐험가 이미지; new
  - `public/assets/rescue-rabbit.png`, `rescue-fox.png`, `rescue-bear.png`, `rescue-cat.png`, `rescue-dog.png` :: 서로 다른 구조 동물 이미지; new
  - `public/assets/exit.png` :: 탈출구 이미지; new
  - `public/assets/maze-floor.png` :: 바닥 텍스처; new
  - `public/assets/maze-wall.png` :: 벽 텍스처; new
  - `src/assets/assetManifest.ts` :: 로컬 에셋 경로 상수; new
  - `src/components/Player/PlayerAppearancePicker.tsx` :: 탐험가 선택 UI; new
  - `src/App.tsx` :: 탐험가 선택 저장 및 게임 전달; modify
  - `src/components/MazeBoard/MazeBoard.tsx` :: 구조 동물별 이미지 연결; modify
  - `src/game/gameState.ts` :: 구조한 동물과 동료 이미지의 순서 일치; modify

#### Details
- 투명 배경의 동일한 시각 언어를 사용하고, 캐릭터 에셋은 셀 안에서 식별 가능한 정사각형 비율을 유지한다.
- 코드에서는 `/assets/...` 경로만 사용하며 원격 URL fallback을 추가하지 않는다.
- 이미지 로딩 실패 시 CSS 색상/이모지 대체 표시를 제공해 게임플레이가 중단되지 않게 한다.

### I02. 스타일 시스템
- Related Files:
  - `src/styles/tokens.css` :: 색상·간격·그림자·상태 토큰; new
  - `src/styles/global.css` :: 전역 레이아웃/폰트/배경; new
  - `src/components/GameScreen/GameScreen.module.css` :: 판타지 게임 셸 스타일; modify

#### Details
- 따뜻한 배경, 고대비 벽, 구조 완료/경고/실패 상태의 색상 토큰을 정의한다.
- 버튼과 인터랙티브 요소는 키보드 focus-visible 스타일을 제공한다.
- `alt` 텍스트와 장식 이미지 `aria-hidden`을 구분한다.

## Acceptance Criteria
- [x] 필수 이미지가 프로젝트 내부에 존재하고 런타임 원격 요청이 없다.
- [x] 에셋 로드 실패 시에도 플레이어가 상태를 확인하고 게임을 진행할 수 있다.
- [x] 판타지 스타일이 HUD, 보드, 오버레이에 일관되게 적용된다.
- [x] 키보드 focus 스타일이 적용되고 고대비 색상 토큰을 사용한다.

## Validation
- `npm run build`
- 브라우저에서 네트워크를 차단한 상태로 게임 로딩 및 에셋 fallback 확인 (브라우저 제어 환경 부재로 T09에서 수동 확인 필요; 로컬 응답·원격 URL 부재·fallback 테스트로 대체 검증)

## Commit Message
```text
feat(assets) : 동물 구출 에셋과 탐험가 선택 및 판타지 스타일 적용

Plan: 2026-09-29-maze-rescue-game
Phase: P03-persistence-assets-validation
Task: T08-local-assets-and-style

- 구출 동물 5종과 탐험가 2종, 탈출구 및 미로 텍스처를 로컬 에셋으로 추가
- 탐험가 선택 저장과 구조 순서에 맞는 동료 표시 구현
- 접근 가능한 판타지 스타일 토큰과 이미지 실패 대체 표시 적용
```

## Progress
- [x] 구현 완료
- [x] 빌드·자동 테스트·로컬 에셋 검증 통과
- [ ] 브라우저 오프라인 수동 확인 (T09)
- commit: pending
