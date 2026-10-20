# Phase: P02 로그인 게임 클라이언트

## Goal

두 경로에 로그인 관문을 만들고, 계정별 서버 진행도와 기기별 일시정지 상태를 연결하며, 랭킹 화면을 제공한다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 브라우저 API 클라이언트와 두 로그인 화면 | [T01](./T01-auth-gate-and-api-client.md) |
| T02 | `done ✅` | App 로그인 관문, 계정별 저장, 서버 도전·기록, 기기 간 진행 동기화 | [T02](./T02-account-game-sync.md) |
| T03 | `done ✅` | 최고 단계·시간 랭킹 화면과 내 순위 | [T03](./T03-leaderboard-ui.md) |

## Progress

- done: 3/3 (complete)
- T01 브라우저 API 클라이언트와 두 로그인 화면 완료 (commit `856e0ca`).
- T02 로그인 관문과 계정별 게임 동기화 완료 (commit `0bba5e1`).
- T03 로그인 유형별 랭킹 화면 완료 (commit `9156a98`).
