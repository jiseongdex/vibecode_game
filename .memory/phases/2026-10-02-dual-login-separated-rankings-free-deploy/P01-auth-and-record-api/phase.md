# Phase: P01 인증 및 기록 API

## Goal

Cloudflare Worker와 D1에 두 계정 유형의 인증, 서버 검증을 거친 단계 기록, 유형별 랭킹 API를 만든다. 브라우저 클라이언트를 변경하기 전에 API의 권한 경계를 테스트한다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | Worker 골격, 공유 계약, D1 스키마와 로컬 환경 | [T01](./T01-worker-d1-foundation.md) |
| T02 | `done ✅` | 닉네임·4자리 PIN 가입/로그인과 세션 | [T02](./T02-simple-account-auth.md) |
| T03 | `done ✅` | Microsoft 개인·조직 계정 OIDC 로그인 | [T03](./T03-microsoft-oidc.md) |
| T04 | `done ✅` | 서버 발급 도전과 계정별 진행·최고 기록 | [T04](./T04-attempts-and-progress.md) |
| T05 | `done ✅` | 로그인 유형별 상위 100명·내 순위 API | [T05](./T05-scoped-leaderboard.md) |

## Progress

- done: 5/5 (active: P02-T01)
- T02 만료 세션 자동 정리 후속 작업 완료 (commit `813e44c`).
- T03 Microsoft OIDC 로그인 완료 (commit `c81d355`).
- T04 서버 발급 도전과 계정별 진행·최고 기록 완료 (commit `a39b697`).
- T05 로그인 유형별 랭킹 API 완료 (commit `6aa9d5c`).
