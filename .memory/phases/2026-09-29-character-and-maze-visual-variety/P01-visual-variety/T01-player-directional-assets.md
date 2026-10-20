# Task: T01 탐험가 2종의 4방향 이미지

## Status: done

## Goal
기존 탐험가 대표 이미지 2장을 기준으로 게임 격자에서 방향이 명확한 투명 배경 이미지 8장을 로컬 에셋으로 추가한다.

## Decision Summary
- 대표 이미지는 보존하고 선택 화면에서 계속 사용한다. 게임용으로 정면·뒷모습·좌·우를 별도로 새로 제작한다.
- 둥근 SD 체형, 살짝 위에서 보는 시점, 밝고 읽기 쉬운 실루엣을 사용한다. 크레이지 아케이드의 시점과 가독성을 참고하되 기존 캐릭터의 독자적 외형을 따른다.

## Implementation

### I01. 기존 탐험가를 기준으로 8장 생성

- Related Files:
  - `public/assets/players/player-girl.png` :: 여자 탐험가 대표 이미지 — 참조 원본; read-only
  - `public/assets/players/player-boy.png` :: 남자 탐험가 대표 이미지 — 참조 원본; read-only
  - `public/assets/players/player-girl-front.png`, `player-girl-back.png`, `player-girl-left.png`, `player-girl-right.png` :: 여자 탐험가 4방향 스프라이트; new
  - `public/assets/players/player-boy-front.png`, `player-boy-back.png`, `player-boy-left.png`, `player-boy-right.png` :: 남자 탐험가 4방향 스프라이트; new

#### Details
- **Signatures & Types**: 코드 심볼 변경 없음. 방향 파일명의 `front`는 게임의 `down`, `back`은 `up`, `left`·`right`는 같은 이름의 `Direction`과 대응한다.
- **Data & Schema Fields**: 저장 스키마 변경 없음. 결과물은 위 정확한 이름의 PNG 8개다.
- **Execution Flow / Logic**:
  1. 두 참조 PNG를 `view_image`로 확인한 후 내장 `image_gen`을 사용한다. 각 캐릭터·방향을 별도의 생성 요청으로 제작하고, 생성 결과를 `public/assets`의 새 파일명으로 복사한다.
  2. 공통 프롬프트 기준: `stylized-concept`, 게임용 단일 전신 SD 캐릭터, 살짝 위에서 보는 2.5D 시점, 머리·후드가 전체 키의 약 60%인 폭 넓은 둥근 실루엣, 짧은 타원형 몸통·아주 작은 둥근 손발, 몸에 붙는 짧은 망토, 중립적인 정지 자세, 중앙 배치, 사방에 여백, 발 위치와 캐릭터 크기를 8장 사이에서 통일, 실제 투명 배경, 글자·로고·다른 캐릭터·배경 소품 없음. 긴 사람 비율의 다리·걷는 보폭·흩날리는 긴 망토는 피한다. 방향마다 몸통과 시선이 해당 방향을 향해야 한다. 좌·우는 단순 좌우반전 대신 각각 독립적으로 생성한다.
  3. 여자 탐험가의 고정 특징: 갈색 땋은 머리, 파란 후드 망토와 금색 무늬, 크림색 옷, 갈색 가방·장화, 손전등 같은 따뜻한 랜턴. 남자 탐험가의 고정 특징: 갈색 헝클어진 머리, 파란색·금색 망토, 크림색 옷, 갈색 가방·장화, 랜턴. 등과 측면에도 망토·가방·랜턴의 일관된 위치와 색을 유지한다.
  4. 각 방향은 정면 얼굴 전체 / 뒷머리와 망토 / 왼쪽 측면 / 오른쪽 측면이 분명히 구별되게 한다. 4장이 같은 넓은 원형 덩어리와 정지 자세를 유지해야 회전 시 형태가 튀지 않는다. SD 스프라이트를 36~52px 셀에 축소해 보아 의상과 방향이 구분되는지 확인한다. 불일치 이미지만 해당 방향으로 다시 생성한다.
  5. 기존 `player-girl.png`·`player-boy.png`는 수정하거나 덮어쓰지 않는다. 생성 파일은 프로젝트 내부 PNG이며 런타임 외부 URL을 사용하지 않는다.
- **Error & Exception Handling**: 생성 결과에 투명 배경이 없거나 신체가 잘리거나 방향이 틀리면 해당 이미지를 채택하지 않고 같은 참조로 다시 생성한다. 내장 생성 도구가 실패하면 임의의 SVG·이모지 대체물로 완료 처리하지 않는다.

## Acceptance Criteria
- [x] 위 8개의 새 PNG가 있고, 두 기존 대표 PNG는 유지된다.
- [x] 같은 캐릭터의 4장은 얼굴·의상·소품이 일치하면서 좌·우·정면·뒷모습이 분명하다.
- [x] 36px 축소 미리보기에서도 방향과 탐험가 종류를 구분할 수 있고 투명 배경을 가진다.

## Validation
- `@(Get-ChildItem -Path 'public/assets/players/player-*.png' | Where-Object { $_.Name -match '^player-(girl|boy)-(front|back|left|right)\.png$' }).Count` — `8` 출력.
- 각 8개 PNG를 `view_image`로 확인하고 투명 배경·방향·의상 일관성과 36px 축소 가독성을 확인한다.

## Commit Message
```text
feat(assets): 탐험가 2종의 4방향 스프라이트 추가

Plan: 2026-09-29-character-and-maze-visual-variety
Phase: P01-visual-variety
Task: T01-player-directional-assets

- 기존 대표 이미지를 기준으로 탐험가 방향별 PNG 8장 제작
- 선택 화면용 대표 이미지 보존
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 4b9cdf6
