# 작업: T03 부드러운 플레이어 렌더링

## 상태: 완료

## 목표
논리 미로 좌표는 이동 입력당 한 칸씩 바뀌되, 플레이어가 화면에서 칸 사이를 부드럽게 이동하도록 한다. 플레이어는 칸이 바뀌어도 계속 렌더링하고 방향·걷기 이미지 전환 중 빈 프레임이 나타나지 않게 한다.

## 결정 요약
- 플레이어 스프라이트를 칸별 조건부 렌더링 밖에 하나만 유지하고 논리 칸 중앙에 배치한다.
- 완화된 CSS 변환 보간을 사용하고 기존 보드 전환 시간 160ms와 맞춘다.
- 선택한 캐릭터의 방향별·걷기 이미지를 미리 불러온다. 이미지 `key`로 요소를 다시 만들지 않는다.
- T01·T02의 UI 임시 `movementAttempt`를 애니메이션 신호로 사용한다. 이동 횟수 통계에 의존하지 않는다.

## 구현

### I01. 플레이어 스프라이트를 하나만 유지하고 위치 보간
- 관련 파일:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`, 플레이어 위치 렌더링; 수정
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSpriteProps`, `PlayerSprite`; 수정
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.playerSprite`, `.board`; 수정
  - `src/components/MazeBoard/boardGeometry.ts` :: `visualCell`; 읽기 전용
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 이동 렌더링; 수정

#### 세부 사항
- **시그니처와 타입**:
  - `PlayerSpriteProps`에 `position: Position`, `cellSize: number`, `movementAttempt: number`를 추가한다. 기존 `appearance?: PlayerAppearance`, `facing: Direction`, `animateMove: boolean`은 유지하되 `moveCount` 속성은 두지 않는다.
  - `visualCell(position)`은 논리 좌표 `(row, col)`를 시각 격자 중앙 `(row * 2 + 1, col * 2 + 1)`로 변환한다.
- **실행 흐름과 로직**:
  1. `MazeCell` 안의 조건부 `<PlayerSprite>`를 제거한다. 칸 렌더링 뒤, `WallLayer` 앞에 `.board` 직접 자식으로 플레이어를 한 번 렌더링해 `state.player`가 바뀌어도 DOM 노드를 유지한다.
  2. 시각 칸 중앙 인덱스에 `cellSize`를 곱해 스프라이트를 배치한다. 인접 칸으로 이동할 때 위치 CSS 변환을 보간한다. `.board`의 160ms 전환과 비슷한 ease-out/ease-in-out 시간으로 캐릭터와 카메라를 맞춘다.
  3. 위치 보간은 시각 효과만 담당한다. reducer 좌표, 벽 충돌, 구출 판정 시점, 동행 동물 위치는 바꾸지 않는다.
  4. `prefers-reduced-motion: reduce`에서 스프라이트와 보드 전환을 끈다.
- **테스트**:
  - 인접 칸 이동 전후 동일한 플레이어 DOM 요소가 유지되고 목표 위치가 시각 칸 2개만큼 바뀌며 CSS 전환이 설정되는지 확인한다.
  - 일반 칸 및 경계 인접 칸 중앙에 플레이어가 한 번만 렌더링되는지 확인한다.
  - 모션 감소 설정에서 시각 전환이 비활성화되는지 확인한다.

### I02. 방향·걷기 이미지 깜박임 방지
- 관련 파일:
  - `src/components/Player/PlayerSprite.tsx` :: 이미지 렌더링과 미리 불러오기; 수정
  - `src/assets/assetManifest.ts` :: `playerSprites`, `playerWalkSprites`; 읽기 전용
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MotionSnapshot`, `MotionState`; 수정
  - `src/components/Rescue/RescueSprite.tsx` :: 동행 동물 애니메이션 신호 속성; 수정
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 플레이어·동행 동물 애니메이션 테스트; 수정

#### 세부 사항
- **데이터와 스키마**: 기본 이미지는 `playerSprites[appearance][facing]`, 걷기 프레임은 `playerWalkSprites[appearance][facing]`의 두 이미지 경로를 쓴다. 저장 필드나 에셋은 추가하지 않는다.
- **실행 흐름과 로직**:
  1. `src`가 바뀌어도 `<img>` 요소는 유지하고 플레이어 이미지의 `key={src}`를 제거한다.
  2. 현재 외형의 네 방향 기본 이미지와 여덟 걷기 프레임을 미리 불러오고 URL별 이미지 객체를 캐시한다. 이미지 오류 시 기존 숨김 처리와 이모지 대체 표시를 유지한다.
  3. `MotionSnapshot`에서 `moveCount` 대신 `movementAttempt`를 이용해 입력 때마다 걷기 애니메이션을 다시 시작한다. 빠른 입력에서도 첫 프레임으로만 고정되지 않게 프레임을 교대하고, 입력이 멈추면 해당 방향 기본 이미지로 돌아간다.
  4. 동행 동물의 홉 효과 재시작 키도 `moveCount`가 아닌 `movementAttempt` 신호로 바꾼다. 실제 위치가 바뀐 동행 동물에만 홉 효과를 적용한다.
  5. 구출 대상 방향 이미지와 다른 동물 표시 동작은 유지한다.
- **테스트**:
  - 방향 및 걷기 프레임 `src` 변경 중 동일한 플레이어 `<img>` 요소가 유지되는지 확인한다.
  - 막힌 입력이 해당 방향 걷기 이미지를 사용하고 방향별 기본 이미지로 돌아오는지 확인한다.
  - 이동 횟수 값 없이 동행 동물 이동 애니메이션이 실제 위치 변화에 맞게 동작하는지 확인한다.
  - 로컬 이미지 오류 대체 표시 및 모션 감소 설정 테스트를 유지한다.

## 완료 기준
- [ ] 플레이어가 논리 이동 규칙을 유지하며 인접 칸 중앙 사이를 부드럽게 이동한다.
- [ ] 칸이나 방향이 바뀌어도 플레이어 스프라이트 DOM 요소 하나가 유지된다.
- [ ] 방향·걷기 이미지 전환 중 요소가 다시 생성되거나 빈 이미지가 보이지 않는다.
- [ ] 플레이어와 동행 동물 애니메이션은 `movementAttempt` 등 렌더 전용 신호를 사용하고 `moveCount`에 의존하지 않는다.
- [ ] 모션 감소 설정에서 위치 전환과 걷기 애니메이션이 꺼진다.

## 검증
- `npm test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 지정한 테스트 모두 통과
- `npm run lint` — TypeScript 빌드 통과

## 커밋 메시지
```text
feat(rendering): 플레이어 이동과 스프라이트 프레임 안정화

Plan: 2026-09-30-smooth-single-cell-movement
Phase: P01-smooth-movement
Task: T03-smooth-player-rendering

- 플레이어 스프라이트 하나를 유지하고 칸 사이 위치 보간
- 이동 통계 의존성 없이 방향·걷기 프레임을 안정적으로 전환
```

## 진행 상태
- [x] 구현 완료
- [x] 검증 통과
- 커밋: 대기
