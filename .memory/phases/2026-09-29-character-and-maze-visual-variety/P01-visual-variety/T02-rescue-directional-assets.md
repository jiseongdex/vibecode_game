# Task: T02 구조 동물 5종의 4방향 이미지

## Status: done

## Goal
현재 구조 동물 5종을 대표 이미지와 닮은 게임용 정면·뒷모습·좌·우 이미지 20장으로 확장한다.

## Decision Summary
- 토끼·여우·곰·흰 고양이·강아지 모두 4방향 개별 이미지를 갖는다. 기존 대표 이미지는 보존한다.
- 둥근 SD 체형과 약간 높은 카메라 시점을 공유하고, 각 동물의 고유 색과 스카프를 유지한다.
- 호송 중의 작은 점프는 T05에서 정지 방향 PNG에 CSS 변형을 적용하므로, T02에서는 추가 점프 프레임을 생성하지 않는다. 네 방향 모두 통통 튀어도 형태가 유지되는 중립적인 정지 자세로 만든다.

## Implementation

### I01. 참조 이미지와 결과물 구성

- Related Files:
  - `public/assets/animals/rescue-rabbit.png`, `rescue-fox.png`, `rescue-bear.png`, `rescue-cat.png`, `rescue-dog.png` :: 기존 대표 이미지 5장; read-only
  - `public/assets/animals/rescue-rabbit-front.png`, `rescue-rabbit-back.png`, `rescue-rabbit-left.png`, `rescue-rabbit-right.png` :: 토끼; new
  - `public/assets/animals/rescue-fox-front.png`, `rescue-fox-back.png`, `rescue-fox-left.png`, `rescue-fox-right.png` :: 여우; new
  - `public/assets/animals/rescue-bear-front.png`, `rescue-bear-back.png`, `rescue-bear-left.png`, `rescue-bear-right.png` :: 곰; new
  - `public/assets/animals/rescue-cat-front.png`, `rescue-cat-back.png`, `rescue-cat-left.png`, `rescue-cat-right.png` :: 흰 고양이; new
  - `public/assets/animals/rescue-dog-front.png`, `rescue-dog-back.png`, `rescue-dog-left.png`, `rescue-dog-right.png` :: 강아지; new

#### Details
- **Signatures & Types**: 코드 변경 없음. 파일명 `front/back/left/right`는 `Direction`의 `down/up/left/right`와 순서대로 대응한다.
- **Data & Schema Fields**: 저장 스키마 변경 없음. 결과물은 정확히 위 PNG 20장이다.
- **Execution Flow / Logic**:
  1. 원본 5장을 `view_image`로 확인하고 각 방향을 별도 내장 `image_gen` 요청으로 생성한다. 결과를 원본을 덮어쓰지 않는 위 파일명으로 프로젝트에 복사한다.
  2. 공통 프롬프트 기준: `stylized-concept`, 하나의 전신 동물 캐릭터, 머리가 전체 키의 약 60%인 폭 넓고 둥근 SD 비율, 작은 타원형 몸통·짧은 손발·몸에 가까운 꼬리와 스카프, 중립적인 정지 자세, 살짝 위에서 보는 2.5D 시점, 게임 36~52px 셀에서 읽히는 단순한 실루엣, 중앙 배치와 충분한 여백, 같은 발 기준선·규모, 실제 투명 배경, 텍스트·로고·다른 대상 없음. 4방향의 둥근 외곽 형태를 일치시키고 긴 다리·과한 보폭·멀리 뻗은 소품은 피한다. 4방향을 별도 생성하며 좌·우를 뒤집기만 하지 않는다.
  3. 고유 특징: 토끼는 크림색 털·긴 귀·초록 스카프·초록 눈; 여우는 주황색 털·흰 얼굴과 꼬리 끝·파란 스카프; 곰은 밝은 갈색 털·크림색 배·붉은 스카프; 고양이는 흰 털·푸른 눈·보라 스카프·풍성한 꼬리; 강아지는 연한 크림색 털·처진 귀·붉은 스카프·말린 꼬리. 등과 측면에서 귀·꼬리·스카프 색이 유지되어야 한다.
  4. `front`는 얼굴, `back`은 뒤통수·꼬리, `left/right`는 해당 측면 실루엣을 분명히 보여야 한다. 각 결과를 36px 정도로 축소해 다른 동물과 혼동되지 않는지 확인한다. 불일치 방향만 다시 생성한다.
  5. 원본 5장은 수정하지 않는다. 모든 새 에셋은 로컬 PNG로 보관한다.
- **Error & Exception Handling**: 배경 불투명, 잘린 귀·꼬리, 소품 색상 변화, 잘못된 방향은 해당 이미지를 다시 생성한다. 생성 도구 실패를 임시 이미지로 대체해 완료 처리하지 않는다.

## Acceptance Criteria
- [x] 동물 5종마다 4방향의 로컬 PNG가 있어 20개다.
- [x] 원본 동물 이미지와 고유 귀·꼬리·털색·스카프가 맞고 각 방향이 서로 구분된다.
- [x] 모두 투명 배경이며 작은 보드 셀에서도 동물 종류가 구분된다.

## Validation
- `@(Get-ChildItem -Path 'public/assets/animals/rescue-*.png' | Where-Object { $_.Name -match '^rescue-(rabbit|fox|bear|cat|dog)-(front|back|left|right)\.png$' }).Count` — `20` 출력.
- 각 20개 PNG를 `view_image`로 확인하고 투명 배경·방향·종별 특징 및 36px 축소 가독성을 확인한다.

## Commit Message
```text
feat(assets): 구조 동물 5종의 4방향 스프라이트 추가

Plan: 2026-09-29-character-and-maze-visual-variety
Phase: P01-visual-variety
Task: T02-rescue-directional-assets

- 동물 5종에 정면·뒤·좌·우 이미지 20장 추가
- 종별 색과 스카프를 기존 대표 이미지에 맞춰 보존
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `577c229`
