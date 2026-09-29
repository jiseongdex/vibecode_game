# Task: T01 Vite React TypeScript 프로젝트 및 테스트 기반 구성

## Status: done

## Goal
빈 저장소를 실행 가능한 Vite + React + TypeScript 게임 프로젝트로 구성하고, 이후 도메인 테스트를 실행할 Vitest 기반을 마련한다.

## Decision Summary
- 프론트엔드는 Vite + React + TypeScript를 사용한다.
- 구현과 검증은 저장소 루트의 표준 `npm` 명령으로 실행한다.

## Implementation

### I01. 프로젝트 실행 기반
- Related Files:
  - `package.json` :: scripts와 의존성 정의; new
  - `index.html` :: 앱 진입 HTML; new
  - `src/main.tsx` :: React root mount; new
  - `src/App.tsx` :: 임시 앱 셸; new
  - `src/vite-env.d.ts` :: Vite 타입 선언; new
  - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` :: TypeScript 설정; new
  - `vite.config.ts` :: Vite 설정; new

#### Details
- `package.json` scripts는 `dev`, `build`, `test`, `test:watch`, `lint`를 제공한다.
- 런타임 의존성은 `react`, `react-dom`; 개발 의존성은 `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`을 사용한다.
- `src/main.tsx`는 `React.StrictMode` 안에서 `#root`에 `App`을 마운트한다.
- `App.tsx`는 다음 Task에서 교체할 수 있는 최소한의 앱 제목과 빈 게임 컨테이너만 렌더링한다.

### I02. 테스트 기반
- Related Files:
  - `vitest.config.ts` :: Vitest 환경 설정; new
  - `src/test/setup.ts` :: jest-dom 초기화; new
  - `src/App.test.tsx` :: 앱 부트스트랩 smoke test; new

#### Details
- 테스트 환경은 `jsdom`, 전역 API 사용, `src/test/setup.ts` setupFiles를 사용한다.
- smoke test는 앱 제목 또는 게임 컨테이너가 렌더링되는지 검증한다.

## Acceptance Criteria
- [x] `npm install` 후 `npm run dev`가 정상 시작된다.
- [x] `npm run build`가 TypeScript 오류 없이 성공한다.
- [x] `npm test -- --run`이 smoke test를 통과한다.

## Validation
- `npm install`
- `npm test -- --run`
- `npm run build`

## Commit Message
```text
feat(scaffold): initialize vite react typescript game app

Plan: 2026-09-29-maze-rescue-game
Phase: P01-foundation-engine
Task: T01-project-scaffold

- Add Vite React TypeScript application shell
- Configure Vitest and jsdom smoke testing
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 완료
