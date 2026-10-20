# Task: T05 인증 유형별 랭킹 API

## Status: done

## Goal

Microsoft 로그인 사용자에게는 Microsoft 기록만, 간편 로그인 사용자에게는 간편 계정 기록만 반환하는 전체 기간 랭킹을 만든다. 최고 단계·해당 단계 최단 시간으로 상위 100명과 내 순위를 제공한다.

## Decision Summary

- 랭킹은 `highest_completed_stage DESC`, 같은 단계에서 `highest_stage_best_time_seconds ASC`다. 같은 단계·시간이면 공동 순위, 화면 표시 순서는 ID로 고정한다.
- 무기록 사용자는 목록에서 빠지고 자신의 항목은 `null`이다. 표시 이름은 Microsoft `name` 또는 간편 닉네임이다.

## Implementation

### I01. DB 조회와 응답 계약

- Related Files:
  - `worker/game/leaderboard.ts` :: `getLeaderboard`, `rankTopEntries`, `getCurrentRank` — 인증 유형별 조회; new
  - `worker/index.ts` :: `fetch` — `GET /api/leaderboard`에 `requireSession` 적용; modify
  - `src/api/contracts.ts` :: `LeaderboardDto`, `LeaderboardEntry` — T01 DTO가 실제 응답과 일치하는지 조정; modify
  - `worker/game/leaderboard.test.ts` :: leaderboard tests — 정렬·필터·공동 순위 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  async function getLeaderboard(env: Env, principal: SessionPrincipal): Promise<LeaderboardDto>
  function rankTopEntries(rows: RankedUserRow[]): LeaderboardEntry[]
  async function getCurrentRank(db: D1Database, principal: SessionPrincipal): Promise<LeaderboardEntry | null>
  // GET /api/leaderboard -> { top: LeaderboardEntry[], current: LeaderboardEntry | null }
  ```
- **Data & Schema Fields**: `users.highest_completed_stage`가 null이 아닌 사용자만 랭킹에 포함한다. `LeaderboardEntry = {rank:number,userId:string,displayName:string,highestStage:number,bestTimeSeconds:number}`. `bestTimeSeconds`는 최고 완료 단계의 최단 시간이며 `src/components/Hud/GameHud.tsx::formatTime`가 화면에서 `mm:ss`로 변환한다.
- **Execution Flow / Logic**:
  1. 인증 세션을 서버에서 읽어 `principal.authType`을 확정한다. 클라이언트가 `authType`, user ID, stage를 쿼리로 지정해 다른 그룹을 요청할 수 없도록 한다.
  2. D1의 `users(auth_type,highest_completed_stage DESC,highest_stage_best_time_seconds ASC,id)` 인덱스를 이용해 동일 auth type에서 기록이 있는 상위 100개를 정렬 조회한다. 동률인 단계·시간에는 `rank`를 공동으로 주고 `id ASC`로 표시 순서만 고정한다.
  3. 내 기록을 별도로 조회한다. 없으면 `current:null`. 있으면 같은 auth type 중 더 높은 단계 또는 같은 단계에서 더 빠른 사용자 수에 1을 더해 내 공동 순위를 계산한다. 상위 100명 안에 이미 들어 있어도 `current`에 같은 항목을 반환한다.
  4. 401은 세션 없음, 성공은 200과 `Cache-Control: no-store`다. 응답에 PIN 관련 컬럼, Microsoft `tid`·`sub`·이메일, Cookie 값은 넣지 않는다.

### I02. 유형 분리와 규모 경계 검증

- Related Files:
  - `worker/game/leaderboard.test.ts` :: `describe('leaderboard')` — Miniflare D1에 양쪽 사용자와 100명 초과 fixture 삽입; modify

#### Details

- **Execution Flow / Logic**: Microsoft/간편 사용자가 같은 표시 이름·점수여도 서로의 목록에 나타나지 않는다. 동점 공동 순위와 다음 순위 건너뛰기, 101위의 `current` 반환, 미완료 사용자의 `current:null`, stage 20 사용자와 더 빠른 stage 19 사용자의 순서를 시험한다. 목록은 100개로 제한한다.

## Acceptance Criteria

- [x] 인증 유형 간 랭킹 행 노출이 없다.
- [x] 최고 단계가 우선이고 같은 단계에서는 짧은 시간이 우선한다.
- [x] 상위 100명과 목록 밖 내 순위를 모두 제공한다.
- [x] 미완료 사용자와 민감한 계정 정보는 노출하지 않는다.

## Validation

- `npm.cmd test -- --run worker/game/leaderboard.test.ts worker/game/runs.test.ts` — 필터·정렬·기록 갱신 통과
- `npm.cmd run lint` — Worker·앱 타입 검사 통과
- `npm.cmd run build` — 배포 자산 빌드 통과
- `git diff --check` — 공백 오류 없음

## Commit Message

```text
feat(rankings): 로그인 유형별 랭킹 제공

Plan: 2026-10-02-dual-login-separated-rankings-free-deploy
Phase: P01-auth-and-record-api
Task: T05-scoped-leaderboard

- 로그인 유형별 최고 단계와 최단 시간으로 순위 계산
- 상위 100명과 로그인한 사용자의 순위 반환
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `6aa9d5c`
