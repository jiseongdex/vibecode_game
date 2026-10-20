# Task: T01 막힌 이동에서 플레이어 크기 안정화

## Status: done

## Goal
막힌 방향 키를 반복해도 플레이어 좌표가 그대로이면 걷기 PNG로 바뀌지 않도록 한다. 실제 이동 시의 두 프레임 걷기와 처음 방향을 바꿀 때의 전환 효과를 유지한다.

## Decision Summary
- `.memory/decisions/2026-10-01-blocked-player-size.md` D01~D02: 고정 위치에서 서로 다른 알파 그림 크기의 PNG를 교체하는 것이 시각적 크기 출렁임의 원인이다. 막힌 입력에는 현재 방향 기본 PNG를 유지한다.
- D03: 이동·충돌·키 반복·카메라·이미지 파일·스프라이트 1.6칸 크기·동물 동작을 변경하지 않는다.

## Implementation

### I01. 이동 성공 여부를 보드 모션 상태에 기록
- Related Files:
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MotionState`, `MazeBoard`의 두 번째 `useLayoutEffect`, `PlayerSprite` props; modify
  - `src/game/gameState.ts` :: `gameReducer`의 `MOVE` 성공·차단 처리; read-only
  - `src/components/GameScreen/GameScreen.tsx` :: `movementAttempt` 증가와 `handleMove`; read-only
  - `src/components/Player/PlayerSprite.tsx` :: `animateMove`가 걷기 이미지 선택에 미치는 영향; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  interface MotionState {
    movementAttempt: number
    playerFacing: Direction
    playerMoved: boolean
    followerMoved: boolean[]
  }
  ```
- **Data & Schema Fields**: `MotionSnapshot.player: Position`과 `state.player: Position`의 `{ row: number; col: number }`를 비교한다. 새 게임 상태·저장 스키마 필드가 아니라 렌더 전용 `MotionState.playerMoved`만 추가한다.
- **Execution Flow / Logic**:
  1. 기존 `samePosition(first, second)`를 사용해 `movementAttempt`가 정확히 1 증가한 경우 `playerMoved: !samePosition(last.player, next.player)`를 `setMotion` 객체에 추가한다.
  2. `PlayerSprite`의 `animateMove`는 `Boolean(currentMotion && currentMotion.playerMoved && currentMotion.playerFacing === state.playerFacing)`일 때만 참으로 전달한다. 기존 모션 스냅샷 갱신·시드/시도 번호 검사는 유지한다.
  3. 막힌 이동은 `movementAttempt`가 증가해도 `state.player`가 그대로이므로 `playerMoved=false`다. `PlayerSprite`는 기존 로직에 따라 `frame=null`, `data-motion='none'`, 현재 `facing`의 `playerSprites[appearance][facing]`를 쓴다. 막힌 방향으로 돌아선 경우 `TurnOverlay`는 현재 `facing` 변화만 보고 기존대로 100ms 실행된다.
  4. 이동 성공은 `playerMoved=true`이므로 기존 55ms 간격의 두 걷기 프레임과 110ms 종료, 스프라이트 위치 전환을 유지한다. 동물의 `followerMoved` 계산에는 손대지 않는다.

### I02. 기존 보드 검증의 막힌 입력 기대값 갱신
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 막힌 이동/걷기 프레임·방향 전환 관련 기존 세 테스트; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: 성공 이동의 키 입력 흐름과 현재 칸 크기 기반 좌표 기대값; modify

#### Details
- **Signatures & Types**: 기존 `stateFor`, `gameReducer`, `render`, `rerender`, fake timer 유틸을 사용한다. 새 테스트 파일은 만들지 않는다.
- **Data & Schema Fields**: 아래 방향 차단 재현 상태는 기존 `stateFor(1, 15)`의 `maze.cells.flat()`에서 `cell.walls.bottom`이 참인 셀을 찾고, `player: {row: cell.row * 2 + 1, col: cell.col * 2 + 1}`, `playerFacing: 'down'`, `status: 'playing'`으로 구성한다. 저장 형식은 변경하지 않는다.
- **Execution Flow / Logic**:
  1. 기존 테스트 `animates blocked attempts and alternates walking feet for movement inputs`에서 막힌 첫 입력의 기대값은 `data-motion='none'`, 현재 방향의 기본 PNG로 바꾼다. 이후 열린 방향으로 성공 이동했을 때 `walk-b`/`walk-a` 두 프레임과 기본 PNG 복귀 검증은 그대로 둔다.
  2. 기존 `restarts the directional walk animation on consecutive blocked attempts without moving` 테스트는 아래쪽 장애물에 막힌 상태로 바꾼다. 시도 번호 1·2와 55ms 경과 후에도 플레이어가 같은 DOM 노드·같은 기본 정면 PNG·같은 `--sprite-size`·같은 `style.translate`·`data-motion='none'`을 유지하는지 확인한다.
  3. 막힌 방향 전환 테스트도 기본 PNG와 전환 오버레이를 기대하도록 갱신한다. reduced-motion 검증과 `GameScreen`의 성공 이동 테스트가 계속 통과해야 한다.
  4. 기존 `GameScreen` 테스트에 남아 있던 26px 칸 크기의 고정 좌표 기대값은 실제 보드의 `--cell-size`와 시각 격자 좌표로 계산한다. 이는 큰 뷰포트로 바뀐 이후의 테스트 기준을 현재 렌더와 맞추기 위한 검증 수정이다.

## Acceptance Criteria
- [x] 아래쪽 장애물에 막힌 채 방향 키를 반복해도 기본 정면 그림과 시각 크기가 일정하다.
- [x] 처음 막힌 방향으로 돌아설 때의 전환 효과는 유지되고, 같은 방향을 반복하면 전환 효과가 재시작되지 않는다.
- [x] 열린 통로로 실제 이동하면 걷기 프레임·위치 이동이 계속 동작한다.
- [x] 게임 충돌·키 반복·카메라·동물 추종 규칙은 유지된다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 막힌 반복 입력, 실제 이동, 방향 전환을 확인한다.
- `npm.cmd run build` — TypeScript와 Vite 빌드를 확인한다.

## Commit Message
```text
fix(maze): 막힌 방향 반복 입력에서 플레이어 크기 안정화

Plan: 2026-10-01-blocked-player-size
Phase: P01-blocked-motion
Task: T01-stabilize-blocked-player

- 실제 이동한 경우에만 걷기 프레임 재생
- 아래쪽 장애물에 막힌 반복 입력 검증 갱신
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (보드·게임 화면 테스트 25개, 빌드)
- commit: Git 기록 참조
