# Task: T01A 탐험가 2종의 발 교대 이미지

## Status: done

## Goal
완료된 여자·남자 탐험가 4방향 중립 PNG를 기준으로 방향마다 서로 다른 두 발 자세를 제작해, 게임 이동 중 실제 발 교대가 보이도록 한다.

## Decision Summary
- 기존 대표 이미지 2장과 T01의 중립 방향 이미지 8장은 보존한다.
- 여자·남자 각각 정면·뒷모습·좌·우 방향에 `walk-a`/`walk-b` 두 자세를 추가한다. 결과는 투명 PNG 16장이다.
- 크레이지 아케이드의 작은 화면에서 방향과 리듬이 읽히는 느낌만 참고하고, 기존 캐릭터의 얼굴·의상·소품은 그대로 유지한다.

## Implementation

### I01. 방향별 두 발 자세 제작

- Related Files:
  - `public/assets/players/player-girl-{front|back|left|right}.png`, `player-boy-{front|back|left|right}.png` :: T01의 중립 방향 기준; read-only
  - `public/assets/players/player-girl-{front|back|left|right}-walk-{a|b}.png` :: 여자 탐험가 발 교대 8장; new
  - `public/assets/players/player-boy-{front|back|left|right}-walk-{a|b}.png` :: 남자 탐험가 발 교대 8장; new

#### Details
- **Signatures & Types**: 코드·저장 스키마 변경 없음. `walk-a`와 `walk-b`는 같은 방향을 바라보면서 화면상 앞에 나온 발과 뒤에 남은 발이 서로 바뀐 자세다. 게임 연결 시 `Direction`의 `up→back`, `down→front`를 T01과 동일하게 적용한다.
- **Data & Schema Fields**: 신규 결과물 16개는 정확히 위 파일명과 실제 투명 배경을 가진 로컬 PNG다.
- **Execution Flow / Logic**:
  1. T01의 해당 방향 PNG를 `view_image`로 확인하고, 각 새 이미지를 해당 중립 이미지와 다른 발 자세 한 장을 참조하여 별도 `image_gen` 요청으로 제작한다. 서로 다른 캐릭터와 방향을 한 이미지에 합치지 않는다.
  2. 머리·후드가 전체 키의 약 60%인 둥근 SD 비율, 짧은 몸통·망토, 동일한 카메라 높이·크기·투명 여백·발 기준선을 유지한다. 얼굴·머리·옷 무늬·가방·랜턴은 해당 중립 이미지와 일치시킨다. 몸통 전체의 방향이나 시선은 걷기 중 바꾸지 않는다.
  3. 정면·뒷모습은 `walk-a`에서 화면 왼쪽 발이 36px 축소 기준 약 2~3px 앞에 나오고 오른쪽 발은 뒤에 남는다. `walk-b`에서는 화면 오른쪽 발이 같은 정도 앞에 나온다. 측면에서는 바라보는 쪽으로 나온 발과 뒤로 빠진 발을 두 자세에서 바꾸며, 겹친 반대편 신발의 끝이 보여 차이가 읽히게 한다. 팔은 발과 반대로 매우 작게 흔들 수 있지만 랜턴·가방이 몸에서 멀리 분리되지 않게 한다.
  4. 정지·A·B를 차례로 36px에서 나란히 놓고 발 교대가 실제로 보이는지, 키·머리 위치·성별·방향·소품이 흔들리지 않는지 확인한다. 발 차이가 안 보이거나 얼굴·망토가 크게 달라진 방향만 다시 만든다. 단순 전체 PNG 회전·좌우반전이나 같은 이미지 복제는 합격하지 않는다.
  5. 기존 `player-girl.png`·`player-boy.png`와 T01의 8장은 수정하지 않는다. T05에서는 이 파일들을 걷기 중에만 선택하고, 정지하면 T01 중립 이미지로 돌아간다.
- **Error & Exception Handling**: 배경 불투명, 발·머리 잘림, 방향 오류, 다른 의상·소품, 36px에서 보이지 않는 발 차이는 재생성한다. 이미지 생성 실패를 CSS 전체 기울임이나 원본 복제로 완료 처리하지 않는다.

## Acceptance Criteria
- [x] 신규 투명 PNG가 여자 8장·남자 8장으로 정확히 16장이고 대표·중립 원본은 보존된다.
- [x] 각 방향의 `walk-a`와 `walk-b`에서 앞에 나오는 발이 실제로 바뀌며 얼굴·의상·소품·둥근 실루엣은 유지된다.
- [x] 36px 정지→A→B 미리보기에서 발 교대가 구별되고 방향 전환 시 캐릭터의 크기와 발 기준선이 갑자기 튀지 않는다.

## Validation
- `@(Get-ChildItem -Path 'public/assets/players/player-*-walk-*.png' | Where-Object { $_.Name -match '^player-(girl|boy)-(front|back|left|right)-walk-(a|b)\.png$' }).Count` — `16` 출력.
- 각 방향의 중립·A·B를 `view_image`와 36px 접촉 시트로 확인한다. PNG 크기·투명 모서리·발 교대 및 기존 원본 변경 없음도 확인한다.

## Commit Message
```text
feat(assets): 탐험가 4방향 발 교대 프레임 추가

Plan: 2026-09-29-character-and-maze-visual-variety
Phase: P01-visual-variety
Task: T01A-player-walk-frames

- 여자·남자 탐험가의 방향별 두 발 자세 PNG 16장 제작
- 기존 대표·중립 방향 이미지를 보존
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 2949628
- 후속 교정: 여자 탐험가 `left-walk-b`의 신발 앞코 방향 수정 (commit: `f717699`).
