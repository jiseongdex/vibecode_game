# 작업: T04 캐릭터 스프라이트 크기 축소

## 상태: 완료

## 목표
플레이어와 모든 구출 동물을 논리 미로 칸의 약 70% 크기로 표시해 각 캐릭터 주변에 칸의 여백이 보이게 한다.

## 결정 요약
- 논리 칸 하나는 시각 격자 칸 두 개 크기다. `visualCell`은 `row * 2 + 1`, `col * 2 + 1`을 반환한다.
- 스프라이트의 목표 너비와 높이는 논리 칸의 70%, 즉 시각 칸 하나의 140%다.
- 플레이어, 대기 중인 구출 대상, 동행 동물에 같은 비율을 적용한다. 벽·출구·바닥 타일은 변경하지 않는다.

## 구현

### I01. 플레이어와 구출 스프라이트 상자 크기 조정
- 관련 파일:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.sprite`, `.sprite img`, `.spriteVisual`, `.playerSprite`, `.rescueSprite`, `.followerSprite`; 수정
  - `src/components/Player/PlayerSprite.tsx` :: T03의 플레이어 클래스·크기 속성; 필요할 때만 수정
  - `src/components/Rescue/RescueSprite.tsx` :: 구출 대상·동행 동물 클래스; CSS 변수 전달이 필요할 때만 수정
  - `src/components/MazeBoard/MazeBoard.tsx` :: `--cell-size` 보드 변수와 렌더링 슬롯; 칸별 CSS 변수가 필요할 때만 수정
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 스프라이트 크기; 수정

#### 세부 사항
- **시그니처와 타입**: 기존 `RescueSpriteProps`와 `PlayerSpriteProps`를 유지한다. 기존 CSS 사용자 변수 `--cell-size`를 사용하며 논리 칸은 `2 * var(--cell-size)` 픽셀이다.
- **실행 흐름과 로직**:
  1. 캐릭터 스프라이트 너비와 높이를 각각 `calc(var(--cell-size) * 1.4)`로 설정한다. 이는 논리 칸 2칸 크기의 70%다. 스프라이트 상자를 논리 칸 중앙에 둔다.
  2. `.sprite`, `.followerSprite`에 남아 70% 상자보다 크게 만드는 음수 `inset` 설정을 제거하거나 대체한다. 이미지와 이모지 대체 표시를 같은 상자에 중앙 정렬하고 `object-fit: contain`을 적용한다.
  3. 플레이어, 구출 대상, 동행 동물에 같은 크기를 적용한다. z-index, 방향 속성, 그림자, 걷기·깡충 애니메이션은 유지한다.
  4. `.exitSprite`, `.obstacleTile`, `.wallBlock`, 바닥 이미지, 보드 크기와 시각 격자 간격은 바꾸지 않는다.
- **테스트**:
  - 플레이어·구출 대상·동행 동물 클래스가 너비와 높이에 시각 칸 1.4배를 적용하는지 확인한다.
  - 플레이어와 구출 동물 이미지가 `object-fit: contain`으로 전체 그림을 표시하는지 확인한다.
  - 구출 위치, 동행 동물 렌더링, 벽 레이어 테스트를 유지한다.

## 완료 기준
- [ ] 플레이어, 구출 대상, 동행 동물은 논리 칸의 약 70% 크기로 표시된다.
- [ ] 스프라이트는 중앙 정렬되고 상자 안에 표시되어 기본적으로 인접 칸을 덮지 않는다.
- [ ] 벽, 출구, 바닥 및 시각 격자 크기는 바뀌지 않는다.

## 검증
- `npm test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 지정한 테스트 모두 통과
- `npm run lint` — TypeScript 빌드 통과

## 커밋 메시지
```text
feat(rendering): 캐릭터를 미로 칸보다 작게 표시

Plan: 2026-09-30-smooth-single-cell-movement
Phase: P01-smooth-movement
Task: T04-smaller-character-sprites

- 플레이어와 구출 동물을 논리 칸의 70% 크기로 조정
- 중앙 정렬과 기존 미로 레이어 유지
```

## 진행 상태
- [x] 구현 완료
- [x] 검증 통과
- 커밋: 대기
