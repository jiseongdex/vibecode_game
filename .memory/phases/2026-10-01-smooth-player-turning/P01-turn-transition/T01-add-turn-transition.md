# Task: T01 플레이어 방향 전환 효과 추가

## Status: done

## Goal
플레이어가 다른 방향을 바라보는 순간 기존 네 방향 이미지 사이에 약 100ms의 짧은 시각 전환을 넣어 이미지가 갑자기 바뀌어 보이는 현상을 줄인다.

## Decision Summary
- `.memory/decisions/2026-10-01-smooth-player-turning.md` D01~D04를 따른다. 새 이미지 파일, 방향 상태, 저장 필드는 만들지 않는다.
- 기존 `PlayerSprite`는 방향별 단일 `<img>`의 `src`를 즉시 교체하고 걷기 프레임은 55ms·110ms 타이머로 제어한다. 기존 `<img>` 노드와 이미지 오류 fallback은 유지한다.

## Implementation

### I01. 이전 방향 이미지를 잠깐 겹쳐 표시
- Related Files:
  - `src/components/Player/PlayerSprite.tsx` :: `PlayerSprite`, `preloadPlayerImages` — 방향 변경 감지와 이전 이미지 표시; modify
  - `src/assets/assetManifest.ts` :: `playerSprites`, `playerWalkSprites`, `PlayerAppearance` — 기존 이미지 맵; read-only
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard` — `facing`, `movementAttempt`, `animateMove` 전달; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  interface PlayerSpriteProps {
    appearance?: PlayerAppearance
    facing: Direction
    position: Position
    cellSize: number
    movementAttempt: number
    animateMove: boolean
  } // 변경하지 않음

  interface RenderedPlayerVisual {
    appearance: PlayerAppearance
    facing: Direction
    src: string
  }
  interface TurnOverlay {
    id: number
    src: string
  }
  const TURN_DURATION_MS = 100
  ```
- **Data & Schema Fields**: 컴포넌트 내부 `useRef<RenderedPlayerVisual>`는 직전 렌더의 외형·방향·실제 표시 이미지 URL을 저장한다. `useRef<number>`는 연속 전환마다 증가하는 `id`를 저장한다. `useState<TurnOverlay | null>`은 현재 사라지는 이전 이미지 URL과 전환 ID를 저장한다. 모두 화면 표시 전용이며 게임 상태·localStorage에 저장하지 않는다.
- **Execution Flow / Logic**:
  1. 기존 `frame`, `frameIndex`, `src` 계산을 유지한다. `useRef`, `useLayoutEffect`를 React import에 추가한다. 현재 `src`가 계산된 뒤 직전 시각 정보를 `useRef`에 보관한다.
  2. 매 렌더의 `useLayoutEffect`에서 직전 `appearance`가 현재와 같고 `facing`만 달라졌을 때 `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches`를 확인한다. 모션 감소가 아니면 직전에 실제 `<img>`에 쓰였던 `src`로 새 `TurnOverlay`를 설정하고 ID를 증가시킨다. 직전 렌더가 없거나 외형만 바뀐 경우, 방향이 같은 반복 입력·걷기 프레임 변경에는 전환을 시작하지 않는다. 모션 감소 상태의 방향 변경이면 기존 전환을 지우고 새 방향을 즉시 표시한다.
  3. 비교 후에는 직전 시각 정보를 현재 `appearance`, `facing`, `src`로 갱신한다. 빠르게 다시 방향이 바뀌면 이전 타이머를 취소하고 가장 최근 렌더 이미지 URL을 새 overlay로 사용한다. `id`는 증가시켜 CSS 애니메이션이 새 방향 변경 때 다시 시작하도록 한다.
  4. `useEffect`에서 `TurnOverlay`가 있으면 `window.setTimeout` 100ms 후 같은 ID일 때에만 overlay를 `null`로 지운다. effect cleanup에서 타이머를 취소하여 재전환·unmount 때 오래된 타이머가 최신 전환을 지우지 않게 한다.
  5. 기존 플레이어 `<img>`와 바로 뒤의 `.spriteFallback` 형제 관계를 유지한다. fallback 뒤에만 `aria-hidden="true"`인 배경 이미지 `<span>`을 조건부로 놓는다. `data-turn-previous`에 이전 이미지 URL을 넣어 검사할 수 있게 한다. `key={turn.id}`로 애니메이션을 새로 시작한다. 접근성상 새 역할·이름은 만들지 않는다. 플레이어의 `data-facing`, `data-grid-row/col`, `data-motion`은 유지한다.
  6. `preloadPlayerImages`가 이미 모든 방향·걷기 프레임을 불러오므로 중복 로더를 만들지 않는다. 이미지가 없을 때의 기존 `onLoad`/`onError` fallback은 그대로 둔다.

### I02. 100ms 페이드와 모션 감소 처리
- Related Files:
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.playerSprite`, 새 `.turnPrevious`, `@keyframes turnFadeOut`, `@media (prefers-reduced-motion: reduce)` — 이전 이미지 표시; modify

#### Details
- **Signatures & Types**: CSS 선택자와 keyframes만 추가한다. `.playerSprite`의 이동 시간 `120ms`와 `.playerSprite[data-motion='walk']`의 걷기 효과 `110ms`는 변경하지 않는다.
- **Data & Schema Fields**: 새 CSS 변수 없음. 이전 URL은 JSX의 inline `backgroundImage`로 전달한다.
- **Execution Flow / Logic**:
  1. `.turnPrevious`는 `position:absolute; inset:0; background-position:center; background-repeat:no-repeat; background-size:contain; pointer-events:none; z-index:1`로 기존 `<img>` 위에 같은 크기로 겹친다. 기존 스프라이트 자체의 `z-index:9`와 장애물·동물 순서는 변경하지 않는다.
  2. `animation: turnFadeOut 100ms ease-out forwards` 및 `@keyframes turnFadeOut { from { opacity:1; } to { opacity:0; } }`로 이전 이미지만 사라지게 한다. 새 방향 `<img>`는 계속 표시되어 빈 프레임이 생기지 않는다.
  3. 모션 감소 미디어 쿼리에 `.turnPrevious { display:none; }`을 추가한다. 환경 설정이 전환 도중 바뀌어도 이전 이미지가 남지 않게 한다.

### I03. 방향 변경·반복 입력 회귀 검사
- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: `describe('MazeBoard')`, 기존 blocked/walk/reduced motion 검사 및 새 방향 전환 검사 — modify

#### Details
- **Signatures & Types**: 기존 `stateFor`, `gameReducer`, `render/rerender`, `vi.useFakeTimers` 패턴을 사용한다. 새 fixture 모델·타입은 만들지 않는다.
- **Data & Schema Fields**: `data-turn-previous`와 기존 `data-facing`, `data-motion`, `<img src>`만 읽는다.
- **Execution Flow / Logic**:
  1. 첫 렌더에서 overlay가 없고 플레이어 이미지가 하나인지 검사한다. 통행이 막힌 방향으로 `MOVE`한 뒤 `facing`이 바뀌면 이전 `src`를 담은 overlay가 생기고 현재 `<img>`는 새 방향을 표시하는지 검사한다. 100ms 뒤 overlay가 사라지는지 fake timer로 확인한다.
  2. 같은 방향으로 반복 입력하고 `movementAttempt`만 증가시킬 때 overlay가 새로 생기지 않고 기존 걷기 프레임이 동작하는지 검사한다.
  3. 첫 전환 100ms 전 다시 다른 방향으로 바꾸면 overlay URL이 직전 렌더 이미지로 갱신되고 오래된 타이머가 최신 overlay를 먼저 지우지 않는지 검사한다. `key`/ID가 달라져 CSS 애니메이션을 다시 시작해야 한다.
  4. `window.matchMedia`가 모션 감소를 반환하는 경우 방향 변경 시 overlay가 없고 새 `<img>`가 즉시 보이는지 검사한다. mock 및 fake timer는 `finally`에서 원복한다.
  5. 기존 플레이어 이미지 노드 유지, 위치 이동, 장애물 위 표시, 걷기 프레임, 이미지 오류 fallback 검사를 삭제·완화하지 않는다.

## Acceptance Criteria
- [x] 실제 방향 변경 시에만 약 100ms 동안 이전 이미지가 사라지며 새 방향이 표시된다.
- [x] 이동 성공과 장애물 앞 방향 변경 모두에서 효과가 작동한다.
- [x] 같은 방향 반복 입력에는 효과가 재시작되지 않고 걷기 프레임은 유지된다.
- [x] 빠른 재전환은 최신 방향을 기준으로 갱신되고 이전 타이머가 최신 효과를 끊지 않는다.
- [x] 첫 렌더·모션 감소 설정에서 전환 효과가 없고 플레이어 접근성 이름·fallback은 유지된다.
- [x] 새 이미지·게임 상태·저장 형식 변경이 없다.

## Validation
- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 방향 전환, 반복 입력, 모션 감소 및 기존 보드 검사 통과.
- `npm.cmd run build` — TypeScript 검사와 Vite 빌드 통과.

## Commit Message
```text
fix(maze): 탐험가 방향 전환을 부드럽게 표시

Plan: 2026-10-01-smooth-player-turning
Phase: P01-turn-transition
Task: T01-add-turn-transition

- 기존 방향 이미지 사이에 짧은 전환 효과 추가
- 빠른 입력과 모션 감소 동작 검증
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
