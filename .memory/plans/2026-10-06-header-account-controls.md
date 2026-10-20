# Plan: 타이틀 하단 사용자 정보 배치

## Goal

로그인 후 타이틀 헤더 하단 오른쪽에 계정 표시 이름과 로그아웃 버튼만 표시하고, 기존 상단 계정 카드와 진행 새로고침 버튼을 없앤다. 모바일에서도 이름과 버튼이 헤더 안에 들어가도록 한다.

## Confirmed Scope

- [결정 문서](../decisions/2026-10-06-header-account-controls.md)의 D01~D04를 따른다.
- 배포 작업의 기존 포인터와 이미 스테이징된 배포 파일을 보존한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 헤더 배치, 불필요한 새로고침 UI 제거, 검증 | [P01](../phases/2026-10-06-header-account-controls/P01-header-layout/phase.md) |

## Execution Order

`P01-T01` 한 작업에서 JSX와 CSS를 함께 바꾼다. 두 파일을 분리하면 한동안 사용자 정보가 잘못된 위치에 보이므로 한 번에 검증한다.
