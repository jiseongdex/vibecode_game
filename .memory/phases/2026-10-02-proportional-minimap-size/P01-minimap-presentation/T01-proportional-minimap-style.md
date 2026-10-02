# Task: T01 비례 미니맵 크기와 투명도 조정

## Status: done

## Goal

맵 틀 내부 오른쪽 하단에 있는 미니맵 외곽을 화면 크기와 관계없이 뷰포트 너비의 `24%`인 정사각형으로 표시한다. 외곽 선은 `1px`로 얇게 하고 배경·벽·마커·시야 표시를 포함한 전체 불투명도를 `70%`로 낮춘다.

## Decision Summary

- [확정 결정](../../../decisions/2026-10-02-proportional-minimap-size.md): 현재 `24%` 중간값은 유지하면서 `88px`·`240px` 제한을 제거한다. `24%`는 패딩·테두리를 포함한 외곽 한 변의 크기다.
- 외곽 테두리만 `2px → 1px`로 조정한다. 미니맵 전체에 `opacity: 0.7`을 적용하고 내부 마커·벽·시야 음영의 개별 스타일과 좌표 계산은 유지한다.
- 현행 `MazeBoard`는 `viewWidth = 1240 * sceneScale`을 `.viewport` 인라인 너비로 지정하고 `<MiniMap>`은 그 직접 자식이다. 따라서 미니맵의 `%` 너비는 맵 틀 내부 너비를 따른다.

## Implementation

### I01. 미니맵 외곽 CSS 수정

- Related Files:
  - `src/components/MazeBoard/MiniMap.module.css` :: `.minimap`, `.map` — modify `.minimap`의 너비·테두리·불투명도만; `.map`은 read-only
  - `src/components/MazeBoard/MiniMap.tsx` :: `MiniMap`과 `data-testid="minimap"` — read-only
  - `src/components/MazeBoard/MazeBoard.tsx` :: `MazeBoard`의 `.viewport` 너비와 `<MiniMap>` 배치 — read-only
  - `src/components/MazeBoard/MazeBoard.module.css` :: `.viewport`의 `position:relative; overflow:hidden` — read-only

#### Details

- **Signatures & Types**:
  ```css
  .minimap {
    /* 기존 position/right/bottom/z-index/box-sizing/padding/radius/background/shadow/pointer-events 유지 */
    width: 24%;
    border: 1px solid var(--color-border);
    opacity: 0.7;
  }
  ```
  TypeScript 함수·prop 시그니처는 변경하지 않는다.
- **Data & Schema Fields**: 새 모델·필드·저장 값 없음. `GameState`, `Maze`, `RescueTarget`, 카메라 프레임 값은 기존 그대로다.
- **Execution Flow / Logic**:
  1. **Precondition & Validation**: 현재 `.minimap { box-sizing:border-box; width:clamp(88px,24%,240px); padding:6px; border:2px solid var(--color-border) }`이고 자식 `.map {width:100%; aspect-ratio:1}`이다. 클래스 이름·DOM 계층을 바꾸지 않는다.
  2. **Core Processing**: `width`를 `24%`로 바꿔 픽셀 최소·최대 제한을 제거한다. `border`만 `1px`로 줄이고 `.minimap`에 `opacity:0.7`을 추가한다. `right`·`bottom` 여백의 `clamp(...)`, `z-index:1`, `pointer-events:none`, 패딩 `6px`, 배경색, 자식의 마커·벽 선·시야 음영 규칙은 유지한다.
  3. **Size Invariant**: `box-sizing:border-box` 때문에 카드 외곽 너비는 `.viewport` 내부 너비의 `0.24`배다. 좌우·상하 패딩이 각각 `6px`, 테두리가 각각 `1px`이고 `.map` 높이가 자체 너비와 같으므로 카드 외곽 높이도 외곽 너비와 같다. 부모 `.viewport`가 `1240px`이면 외곽은 `297.6×297.6px`, `620px`이면 `148.8×148.8px`, `1587.2px`이면 `380.928×380.928px`이다. 실제 브라우저에서는 하위 픽셀 반올림 오차를 허용한다.
  4. **Opacity**: 부모의 `opacity:0.7`은 배경·벽·마커·시야 테두리·기존 `22%` 바깥 음영을 한 번에 합성한다. 내부 요소별 opacity를 추가하거나 기존 음영 알파를 바꾸지 않는다.
  5. **Error & Exception Handling**: 별도 JS 예외·상태 전환 없음. 작은 뷰포트에서 픽셀 최소값이 사라져 지도가 더 작아질 수 있지만 이는 사용자가 선택한 일정 비율 요구다. 미니맵이 뷰포트 밖으로 넘치지 않고 기존 입력·팝업 위계를 유지해야 한다.
- **State Transition & Return**: CSS 표시만 바뀐다. 컴포넌트 상태나 게임 규칙은 그대로다.

### I02. 표시와 기존 기능 검증

- Related Files:
  - `src/components/MazeBoard/MazeBoard.test.tsx` :: 단계별 미니맵·마커·카메라·배율 회귀 테스트 — read-only
  - `src/components/GameScreen/GameScreen.test.tsx` :: 입력·일시정지·결과 흐름 — read-only
  - `package.json` :: `test`, `lint`, `build`, `dev` 스크립트 — read-only

#### Details

- **Test Cases / Checks**:
  1. 기존 `MazeBoard.test.tsx`의 15칸·33칸 지도, 미구조 동물 제거, 탈출구, 시야 테두리, 배율 변경 테스트가 통과하는지 확인한다. 이번 변경은 CSS 선언만 바꾸므로 구현 문자열을 그대로 반복하는 새 단위 테스트는 추가하지 않는다.
  2. `npm.cmd run build`로 CSS 모듈이 빌드되는지, `npm.cmd run lint`로 TypeScript 회귀가 없는지 확인한다.
  3. 브라우저를 사용할 수 있으면 `npm.cmd run dev -- --host 127.0.0.1`에서 단계 1과 20을 열고 `.viewport`·`[data-testid="minimap"]`의 `getBoundingClientRect()`를 비교한다. 창을 바꿔 맵 틀 내부 너비가 달라져도 `minimap.width / viewport.width ≈ 0.24`, `minimap.height / minimap.width ≈ 1`인지 확인한다. `getComputedStyle(minimap).borderTopWidth === '1px'`, `opacity === '0.7'`도 확인한다. 오른쪽·아래쪽 배치, 동물·출구·시야 읽기 쉬움, 플레이 입력과 일시정지·결과 팝업의 위계를 함께 살핀다.
  4. 브라우저 제어가 불가능하면 자동 검증 범위와 미실시된 실제 화면 항목을 Task 진행 기록과 사용자 보고에 명시한다. 실제 브라우저 확인을 했다고 기록하지 않는다.

## Acceptance Criteria

- [x] 미니맵 외곽의 한 변은 뷰포트 내부 너비의 `24%`이며 픽셀 최소·최대 제한이 없다.
- [x] 미니맵 외곽은 정사각형이고 오른쪽 하단에 머물며 테두리 선 `1px`, 전체 불투명도 `0.7`을 적용한다.
- [x] 전체 지도·동물·탈출구·시야 표시와 읽기 전용 동작은 유지된다.
- [x] 지정 회귀 테스트, 타입 검사, 프로덕션 빌드가 통과하고 브라우저 사용 여부와 시각 확인 범위를 기록한다.

## Validation

- `npm.cmd test -- --run src/components/MazeBoard/MazeBoard.test.tsx` — 기존 미니맵 렌더·구조·카메라·배율 회귀 테스트 통과.
- `npm.cmd run lint` — TypeScript 검사 통과.
- `npm.cmd run build` — CSS 모듈을 포함한 프로덕션 빌드 통과.
- `npm.cmd run dev -- --host 127.0.0.1` — 브라우저 사용 가능 시 실제 뷰포트/미니맵 비율·정사각형·1px·0.7 및 가독성 확인; 불가능하면 미검증 항목 명시.

## Commit Message

```text
fix(minimap): 맵 틀 비례 크기와 투명도 적용

Plan: 2026-10-02-proportional-minimap-size
Phase: P01-minimap-presentation
Task: T01-proportional-minimap-style

- 미니맵의 픽셀 크기 제한을 제거하고 맵 틀 너비의 24%로 고정
- 외곽 테두리를 1px로 줄이고 전체 불투명도를 70%로 조정
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — `MazeBoard.test.tsx` 23개, `npm.cmd run lint`, `npm.cmd run build`, 개발 서버 HTTP 200.
- 브라우저 제어 도구에 연결된 브라우저가 없어 실제 `getBoundingClientRect()` 비율·표시 대비·팝업 겹침의 육안 검사는 수행하지 못했다. CSS 구조와 자동 검증으로 확인한 범위와 구분한다.
- commit: 이 Task의 구현 커밋 (`git log` 참조)
