# Decisions: 구출 전 철장·반짝이는 탈출구·구출 완료 안내

- Date: 2026-10-02
- Status: Confirmed

## D01. 구출 전 동물의 철장

- **Chosen**: 기존 동물 이미지는 유지하고 그 위에 투명 배경의 귀여운 금속 철장 PNG를 겹쳐 구출 전 갇힌 느낌을 준다. 동물의 얼굴과 종류는 철창 사이로 알아볼 수 있어야 한다. 구출한 뒤 따라오는 동물에는 철장을 표시하지 않는다.
- **Rationale**: 사용자가 동물 이미지 위에 생성한 철장 이미지를 겹치도록 요청했다. 철장을 별도 자산으로 두면 다섯 종류 동물에 같은 연출을 재사용할 수 있다.
- **Code basis**: `RescueSprite`는 `following=false`인 미구출 동물에 `rescueSprite`, 구출 후 동료에 `followerSprite`를 적용한다. `MazeBoard`는 미구출 대상만 별도로 렌더링하고 구출 후에는 follower로 바꾼다. 기존 동물 PNG는 투명 배경이다.
- **Asset direction**: 기존 동물의 부드러운 동화풍과 어울리는 둥근 철장 프레임·성긴 수직 창살을 투명 PNG로 생성한다. 동물 자체를 새 이미지에 합성하지 않고 철장만 독립 자산으로 만든다. 크기와 위치를 동물 스프라이트에 맞추며 입력을 막지 않는다.

## D02. 탈출구의 별빛

- **Chosen**: 기존 `public/assets/maps/exit.png` 문 이미지를 유지하고 별빛·광채 효과를 더한다. 모든 동물을 구출하기 전에는 현재의 잠긴 표시를 유지하고, 구출 후에만 강하게 반짝인다.
- **Rationale**: 사용자가 기존 문 이미지를 유지하며 구출 완료 후 강조하는 방식을 선택했다. 문이 열리는 게임 규칙과 시각 신호가 맞아야 한다.
- **Code basis**: `ExitSprite`는 `unlocked`를 받아 `.exitUnlocked`를 적용하고, `MazeBoard`는 `rescues.every(target => target.rescued)`로 잠금 해제를 판단한다. 현재 탈출구는 잠긴 상태에서 회색 필터, 열린 상태에서 작은 그림자 효과만 있다.
- **Asset direction**: 기존 문 위에 겹칠 수 있는 투명한 금빛 별빛/반짝임 이미지를 만들고 열린 상태에서만 보여준다. 부드러운 반짝임 움직임을 적용하되 `prefers-reduced-motion`에서는 정적인 밝은 표시로 둔다.

## D03. 구출 완료 알림

- **Chosen**: 단계의 **마지막 동물**을 구출한 순간 `동물 구출 완료! 탈출구를 찾자`를 미로 위쪽 중앙의 작은 알림으로 약 1.5초 표시한다. 알림 중에도 이동과 게임 시간은 계속된다.
- **Rationale**: 탈출구가 모든 동물 구출 후 열리므로 마지막 구출 직후가 문구와 맞다. 작은 비차단 알림은 플레이를 가리지 않는다.
- **Code basis**: `GameState.rescues`의 `rescued` 플래그를 `MOVE`에서 바꾸고, `GameScreen`은 현재 구출 수와 총수를 알고 있다. 이전 구출 수에서 전체 구출로 바뀌는 전이를 감지하면 된다. 저장 상태를 복원했을 때 이미 모두 구출된 경우에는 과거 알림을 다시 띄우지 않는다.
- **Behavior**: 일시 정지·승리·패배·재도전·단계 이탈 시 알림을 정리한다. 새 저장 필드는 만들지 않는다. 화면 읽기 도구가 한 번 읽을 수 있게 접근성 상태 문구를 제공한다.

## D03a. 탈출구 문 크기와 장애물 앞뒤 관계

- **Chosen**: 탈출구 문 이미지를 플레이어와 같은 `1.6 × cellSize` 영역으로 키우고, 발이 놓이는 기준을 탈출구 셀과 맞춘다. 문을 가로막는 앞쪽 장애물은 문보다 위에, 뒤쪽 장애물은 문보다 아래에 보이게 행 기반 깊이를 적용한다. 위에서 내려다보는 현재 미로 시점에 맞도록 기존 문 원본 이미지를 보존하고 위치·레이어로 조정한다.
- **Rationale**: 사용자가 문을 플레이어 크기만큼 키우고 장애물이 있을 때 플레이어처럼 자연스러운 앞뒤 관계로 표시하길 추가 요청했다.
- **Code basis**: 플레이어는 `PLAYER_SPRITE_SCALE=1.6`, `(row - 0.3) × cellSize` 위치와 `playerDepth(row)`를 쓴다. 장애물은 `wallDepth(visualRow)`를 쓴다. 현재 `.exitSprite`는 `1 × cellSize`이고 `z-index: var(--foreground-depth)`라 모든 장애물 위에 떠 보일 수 있다. `ExitSprite`는 `MazeCell` 안에 있으므로 셀 기준 `top/left: -0.3 × cellSize`, `width/height: 1.6 × cellSize`로 맞추고 `MazeBoard`에서 exit의 시각 행을 넘겨 `playerDepth(exit.row)`를 적용한다.

## D04. 단계 선택 안내 문구 크기와 오타

- **Chosen**: `동물들을 구하러 탐험을 떠자나!`를 `동물들을 구하러 탐험을 떠나자!`로 고치고 글꼴 크기를 줄인다. `동물 친구를 구출하고 탈출구를 찾으면 다음 단계가 열려요.`도 글꼴 크기를 줄인다. 다른 제목·단계 카드·진행률 문구의 크기는 유지한다.
- **Rationale**: 사용자가 두 문구의 축소와 첫 문구 오타 수정을 선택했다.
- **Code basis**: 첫 문구는 `src/App.tsx`에서 렌더링되고 `src/styles/global.css`의 `body > #root > main > header p`가 `clamp(26px, 3vw, 32px)`를 적용한다. 둘째 문구는 `CampaignScreen`의 `.intro`이며 `CampaignScreen.module.css`에서 `.intro, .progress, .pickerLabel` 공통 27px, 모바일 공통 25px가 적용된다. 둘째 문구만 줄이려면 선택자를 분리해야 한다.
- **Worktree note**: `src/App.tsx`와 `src/components/Campaign/CampaignScreen.tsx`의 두 문구는 현재 커밋되지 않은 사용자 변경이다. 구현 시 그 변경을 보존하고 첫 문구 오타 수정 외에는 덮어쓰지 않는다.

## 범위와 확인 사항

- 사용자 확정: 마지막 동물 때만 1.5초 알림, 미로 위쪽 중앙의 비차단 표시, 구출 완료 후 강한 탈출구 반짝임, 기존 문 이미지 유지, 첫 문구 오타 수정.
- 코드에서 확인: 미구출/추종 동물의 분리 렌더링, 모든 동물 구출 시 탈출구 해제, 두 문구의 실제 CSS 규칙, 미커밋 사용자 문구 변경.
- 구현은 `/memory-plan` 후 `/memory-execute` 단계에서 진행한다. 생성 자산은 투명 배경·기존 동화풍과의 조화·작은 미로 셀에서의 가독성을 확인한다.
