# Task: T01 동물 이미지와 위치 이동의 깜박임 개선

## Status: done

## Goal

연속 이동·방향 전환 중 구출 동물의 이미지 노드가 다시 생성되지 않고 위치가 플레이어와 같은 `translate` 전환으로 연결되도록 한다.

## Decision Summary

- 동물 방향 이미지는 `src`만 갱신한다. `key={src}`를 제거하고 다른 방향 이미지를 미리 로드한다.
- 동물의 `top`·`left` 위치 전환을 `translate` 전환으로 바꾸며 120ms 선형 시간을 유지한다.
- 동물의 방향, 종류, 순서, 철장, 플레이어 코드는 유지한다.

## Implementation

### I01. 방향 이미지 연속성

- Related Files:
  - `src/components/Rescue/RescueSprite.tsx` :: `RescueSprite`, module-scope animal image cache and preload helper; modify
  - `src/assets/assetManifest.ts` :: `getRescueAnimal`, `Animal.sprites` 계약; read-only
  - `src/components/Player/PlayerSprite.tsx` :: 기존 이미지 사전 로드 패턴; read-only

#### Details

- **Signatures & Types**: `const animalImageCache = new Map<string, HTMLImageElement>()`; `function preloadAnimalImages(animalId: string): void`. `getRescueAnimal(animalId).sprites`의 `Object.values`를 돌며 아직 없는 `src`에 `new Image()`를 생성해 `src`를 지정하고 지원될 때 `decode().catch(() => undefined)`를 호출한다.
- **Data & Schema Fields**: `GameState`, 저장 형식, `RescueSpriteProps` 필드는 변경하지 않는다. 캐시는 URL에서 이미지 객체로 가는 모듈 내부 Map이며 저장되지 않는다.
- **Execution Flow / Logic**:
  1. `useEffect([animalId])`에서 네 방향 이미지를 미리 로드한다. 같은 동물의 구출 전·후 스프라이트가 함께 렌더링되어도 캐시로 중복 로드를 피한다.
  2. 동물 `<img>`의 `key={src}`를 제거하고 기존 노드의 `src`만 변경한다. `onLoad`에서 `hidden=false`, `onError`에서 `hidden=true`로 이미지 실패와 회복을 처리한다.
  3. 새로운 동물을 따라오게 할 때에도 현재 방향과 동물 ID의 이미지가 기존 계약대로 표시된다.
- **Error & Exception Handling**: 사전 로드 `decode()` 실패는 화면 렌더를 막지 않는다. 실제 `<img>` 로드 실패 시 기존 이모지 fallback을 보이고, 다른 유효한 방향 이미지가 로드되면 다시 보인다.
- **State Transition & Return**: 이미지 사전 로드는 게임 로직을 바꾸지 않고 DOM `<img>` 한 개를 유지한다.

### I02. 플레이어 방식의 위치 전환

- Related Files:
  - `src/components/Rescue/RescueSprite.tsx` :: `spriteLeft`, `spriteTop`, root style; modify
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.followerSprite`, `.rescueSprite`, reduced-motion; modify

#### Details

- 스프라이트 루트 inline style의 `top`/`left`를 `0`으로 고정하고 `translate: \`${spriteLeft}px ${spriteTop}px\``를 지정한다. 기존 `transform: 'none'`과 1.4 셀 크기는 유지한다.
- `.followerSprite`를 `transition: translate 120ms linear; will-change: translate;`로 변경한다. 구출 전 `.rescueSprite`에는 위치 전환을 추가하지 않는다. 기존 `@media (prefers-reduced-motion: reduce)`의 `.sprite { transition: none }`은 그대로 유효하다.
- `MazeBoard`의 follower key `follower-${index}`와 좌표·순서 계산은 건드리지 않는다.

### I03. 연속 이동 회귀 테스트

- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 동물 위치·빠른 방향 전환·이미지 실패 회복 검사; modify
  - `src/components/GameScreen/GameScreen.test.tsx` :: 게임 입장·구출 회귀; read-only

#### Details

- 기존 `top`/`left` 인라인 위치 기대를 `translate` 기대값으로 바꾼다. 구출 전 동물과 따라오는 동물 모두 보드 내 위치가 맞는지 확인한다.
- 기존 follower 이동 테스트에서 처음 잡은 `<img>`가 두 번 이상의 빠른 `rerender`와 방향 변경 뒤에도 동일한 DOM 요소인지 확인한다. 각 단계에서 `src`, `data-facing`, `data-grid-row`/`data-grid-col`, `translate`를 검증한다.
- 동물 이미지에서 `fireEvent.error` 이후 fallback을 확인하고, 방향을 바꿔 `fireEvent.load`를 발생시키면 같은 `<img>`의 `hidden`이 해제되는지 확인한다.

## Acceptance Criteria

- [x] 빠른 연속 이동과 방향 전환에서 동물 이미지 DOM 요소가 유지된다.
- [x] 동물 위치가 플레이어처럼 120ms `translate` 전환을 쓴다.
- [x] 이미지 실패 후 다른 방향 이미지가 로드되면 이모지 fallback에서 회복된다.
- [x] 구출 전 철장, 동물 종류·순서·방향, 플레이어 이동이 유지된다.
- [x] 관련 테스트와 전체 테스트, 빌드가 통과한다.

## Validation

- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx src/components/GameScreen/GameScreen.test.tsx` — 동물 위치·연속 방향 전환과 게임 회귀.
- `npm.cmd test -- --run` — 전체 테스트.
- `npm.cmd run build` — 타입과 번들.
- `git diff --check` — 공백 오류 없음.

## Commit Message

```text
fix(game): 빠른 동물 이동의 깜박임 완화

Plan: 2026-10-02-follower-motion-flicker
Phase: P01-continuous-follower-motion
Task: T01-stable-follower-image-and-position

- 방향 이미지 노드를 유지하고 미리 로드
- 따라오는 동물을 translate로 부드럽게 이동
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
