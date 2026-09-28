# 패턴 디자이너 — Product Consolidation (UX/IA) 보고

**일시:** 2026-09-28 (KST)  
**범위:** UX/IA만. 신규 알고리즘·AI Review·Utility→Planner 자동연결·HTN/EQS/Influence/Steering **없음**.  
**원칙:** FSM/HFSM/BT/Utility/GOAP **내부 모델·런타임 유지**(호환 레이어). 사용자 언어·정보구조만 정리.

## 한 줄 요약

행동 저작 도구(상황/판단/행동/목표/조건/문맥)로 기본 UI를 재정렬했고, 하단을 **문맥 | 시뮬레이션 | 검증 | 리뷰** 4탭으로 수렴했습니다. 캔버스가 주인공이며, 목표 작성은 시뮬레이션의 **고급**으로 내려 GOAP 에디터처럼 보이지 않게 했습니다.

## 변경 요약

| 항목 | 내용 |
|------|------|
| 하단 IA | 정확히 4탭: 문맥 · 시뮬레이션 · 검증 · 리뷰 |
| 접어 넣기 | Decision Trace / 목표·계획 / 실행기록 → **시뮬레이션** (선택 맥락별) |
| 문맥 | 변수·테스트 오버라이드 (+ 고급: 행동·조건 카탈로그) |
| 리뷰 | 스텁 (규칙 검증 요약만, AI 리뷰 없음) |
| 용어 | WORLD/GOAL STATE/PLAN/Preconditions/Effects → 현재 상황/문맥, 원하는 결과, 사용할 수 있을 때, 행동 후, 비용, 실행 계획 |
| 캔버스 | `goal-plan-tall` 제거 → 하단 높이 유지 |
| 생성 UX | Behavior 생성 시 FSM/HFSM/BT/Utility/GOAP 선택 **없음** (기존 유지) |
| 내부 | `goapPlanner` / `utilitySimulation` / XState·Mistreevous 어댑터 **삭제 없음** |

## 시나리오 검증 (알고리즘 용어 없이)

**경비:** 순찰 → 플레이어 발견 → 경계 → 행동 판단 → 공격 선택 → (멀면) 접근 목표·실행 계획

스크린샷 (`/workspace/screenshots/` 및 `docs/`):

1. `pr-consol-guard-patrol.png` — 순찰 + 시뮬레이션(상황 흐름)
2. `pr-consol-guard-alert.png` — 경계
3. `pr-consol-guard-decision.png` — 행동 판단
4. `pr-consol-guard-attack.png` — 공격 선택
5. `pr-consol-guard-approach-goal.png` — 목표·실행 계획 (디자이너 언어)
6. `pr-consol-four-tabs-overview.png` — 4탭 개요

QA 스크립트에서 GOAP / Goal State / Preconditions / (World) / Plan Trace **노출 없음** 확인.

## 검증 결과

| 검사 | 결과 |
|------|------|
| `npm run typecheck` | 통과 |
| `npm test` (vitest) | **20 files / 68 tests** 통과 (consolidation 수용 테스트 포함) |
| `build.ps1 -Only pattern` | 통과 (typecheck · lint · test · build:studio) |

## 주요 파일

- `src/components/BottomPanel.tsx` — 4탭 + 시뮬레이션 맥락 패널
- `src/components/GoalPlanPanel.tsx` — 용어 치환, `variant=simulation`, 작성→고급
- `src/components/DecisionTracePanel.tsx` — Decision Trace 표기 완화
- `src/editor/model.ts` — `DrawerTab = context \| simulation \| validation \| review`
- `src/App.tsx` — 탭 ID 마이그레이션
- `src/styles.css` — tall drawer 제거, 시뮬레이션/고급 스타일
- `src/editor/productConsolidation.acceptance.test.tsx`
- `scripts/qa-product-consolidation.mjs`

## 남긴 것 / 의도적 비범위

- 샘플 세트에 **호환용** FSM/HFSM/BT 그래프 이름 잔존 (생성 다이얼로그에 선택지 없음)
- Inspector의 “유틸리티(고려 요인 점수)”는 기존 PR4 판단 방식 표기 (알고리즘 피커 아님)
- AI 리뷰 · Utility→Planner 자동 연결 · HTN/EQS 등 **미구현** (요청대로)
