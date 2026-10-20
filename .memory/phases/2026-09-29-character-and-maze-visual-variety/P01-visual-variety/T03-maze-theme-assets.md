# Task: T03 네 가지 맵 테마의 바닥·장애물 이미지

## Status: done

## Goal
숲·사탕·얼음·사막에서 바닥 2종과 경계 장식용 입체 장애물 3종씩, 총 20장의 로컬 이미지를 제작해 새로운 미로 보드 표현의 재료를 준비한다.

## Decision Summary
- 새 미로마다 네 테마 중 하나를 선택하며, 같은 미로의 재도전·이어하기에서는 같은 테마를 사용한다.
- 장애물은 기존 닫힌 벽을 표현할 뿐 통로·충돌 규칙을 바꾸지 않는다. 크레이지 아케이드의 밝고 읽기 쉬운 장애물 느낌을 참고해 독자적인 형태로 만든다.

## Implementation

### I01. 바닥 텍스처 8장

- Related Files:
  - `public/assets/maps/maze-forest-floor-01.png`, `maze-forest-floor-02.png` :: 흙길·잔디/돌바닥; new
  - `public/assets/maps/maze-candy-floor-01.png`, `maze-candy-floor-02.png` :: 파스텔 과자 타일/설탕길; new
  - `public/assets/maps/maze-ice-floor-01.png`, `maze-ice-floor-02.png` :: 옅은 얼음판/서리 낀 타일; new
  - `public/assets/maps/maze-desert-floor-01.png`, `maze-desert-floor-02.png` :: 모래빛 돌판/황토 타일; new
  - `public/assets/maps/maze-floor.png` :: 기존 바닥 텍스처; read-only

#### Details
- **Signatures & Types**: 코드 심볼 변경 없음. 파일명 `maze-{forest|candy|ice|desert}-floor-{01|02}.png`을 다음 Task의 manifest가 그대로 참조한다.
- **Data & Schema Fields**: 저장 데이터 변경 없음. 결과물은 정사각형 로컬 PNG 8장이다.
- **Execution Flow / Logic**:
  1. 내장 `image_gen`으로 각 변형을 개별 생성하고 프로젝트의 정확한 파일명으로 복사한다.
  2. 각 바닥은 위에서 살짝 내려다보는 정사각형 타일 텍스처이며 인접 셀 사이에서 반복해도 과한 경계가 없고, 캐릭터 밑 중앙은 단순하고 명도가 충분해야 한다. 색조와 세부 무늬는 테마 안에서 통일한다.
  3. `01`과 `02`는 같은 소재·팔레트 안에서 미세한 패턴 차이를 둔다. 바닥에 벽·구조 동물·탈출구·문자·로고를 그리지 않는다.
  4. 기존 `maze-floor.png`는 덮어쓰지 않는다.

### I02. 경계 장식용 장애물 12장

- Related Files:
  - `public/assets/maps/maze-forest-wall-01.png`, `maze-forest-wall-02.png`, `maze-forest-wall-03.png` :: 나무 상자/이끼 낀 돌 블록/버섯 그루터기; new
  - `public/assets/maps/maze-candy-wall-01.png`, `maze-candy-wall-02.png`, `maze-candy-wall-03.png` :: 줄무늬 설탕 상자/둥근 사탕 블록/초콜릿 웨이퍼 블록; new
  - `public/assets/maps/maze-ice-wall-01.png`, `maze-ice-wall-02.png`, `maze-ice-wall-03.png` :: 반투명 얼음 블록/눈 쌓인 얼음 상자/서리 낀 수정 블록; new
  - `public/assets/maps/maze-desert-wall-01.png`, `maze-desert-wall-02.png`, `maze-desert-wall-03.png` :: 사암 블록/무늬 있는 점토 상자/층진 바위 블록; new
  - `public/assets/maps/maze-wall.png` :: 기존 벽 텍스처; read-only

#### Details
- **Signatures & Types**: 코드 심볼 변경 없음. 파일명 `maze-{theme}-wall-{01|02|03}.png`을 다음 Task의 manifest가 그대로 참조한다.
- **Data & Schema Fields**: 정사각형 투명 배경 PNG 12장. 보드에서는 닫힌 셀 경계의 가운데에 놓이는 블록 장식으로 사용한다.
- **Execution Flow / Logic**:
  1. 각 블록은 약간 높은 카메라에서 윗면과 앞면이 보이는 둥근 입체 형태로, 단일 물체만 중앙에 두고 외곽에 여백을 둔다. 주변 바닥을 그리지 않아 투명 배경에서 독립적으로 보인다.
  2. 각 테마의 세 변형은 물질과 실루엣이 서로 달라야 하며 바닥 팔레트와 조화되어야 한다. 이미지 전체를 축소해 약 16~22px로 놓아도 형태와 테마가 읽혀야 한다.
  3. 장애물 이미지가 미로 통로를 채우지 않도록 중앙 장식용으로 제작한다. 닫힌 경계의 연속된 막힘은 후속 CSS가 색상 막대로 나타내고 이 이미지는 그 위에 배치한다.
  4. 기존 `maze-wall.png`는 덮어쓰지 않는다. 문자·브랜드·기존 게임 캐릭터/장애물의 복제는 포함하지 않는다.
- **Error & Exception Handling**: 투명도가 없거나 작은 크기에서 벽과 바닥을 구분할 수 없는 결과는 같은 테마로 다시 생성한다. 이미지 생성 실패를 임시 CSS 도형만으로 완료 처리하지 않는다.

## Acceptance Criteria
- [x] 네 테마에 바닥 2장과 경계 장식용 벽 장애물 3장씩 총 20개의 새 PNG가 있다.
- [x] 바닥은 셀 반복에 적합하고 중앙 캐릭터를 가리지 않는다. 벽 블록은 투명 배경과 입체 실루엣이 있다.
- [x] 숲·사탕·얼음·사막을 색상과 소재로 구별할 수 있고 기존 두 환경 원본은 유지된다.

## Validation
- `@(Get-ChildItem -Path 'public/assets/maps/maze-*.png' | Where-Object { $_.Name -match '^maze-(forest|candy|ice|desert)-(floor-(01|02)|wall-(01|02|03))\.png$' }).Count` — `20` 출력.
- `view_image`로 각 20개 파일의 반복 가능성, 장애물 투명도, 36~52px 셀 미리보기 가독성을 확인한다.

## Commit Message
```text
feat(assets): 네 가지 미로 테마의 바닥과 장애물 추가

Plan: 2026-09-29-character-and-maze-visual-variety
Phase: P01-visual-variety
Task: T03-maze-theme-assets

- 숲·사탕·얼음·사막별 바닥 2종과 입체 경계 장애물 3종씩 제작
- 기존 바닥·벽 에셋 보존
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `c1efa29`
