# 패턴 디자이너 — PR7 Designer Language & Product Cleanup

**일시:** 2026-09-28 (KST)  
**범위:** 제품 언어·표시명·예제 노출만. 신규 알고리즘·Utility/BT 확장·노드 타입·AI Review·엔진 export **없음**.  
**원칙:** FSM/Utility/GOAP 런타임·데이터 키 **유지**. 기본 UX에서만 기획자 언어로 수렴.

## 한 줄 요약

첫 방문 게임기획자가 FSM/HFSM/BT/Utility/GOAP를 몰라도 **상황 → 판단 → 행동**과 **목표 · 실행 계획**을 읽고 시뮬할 수 있게 기본 UI 용어를 정리했습니다. 레거시 샘플은 **고급 · 레거시 예제**로 접었습니다.

## 변경 요약

| 항목 | 내용 |
|------|------|
| 판단 Inspector | `유틸리티 (고려 요인 점수)` → **고려 요인 비교** |
| 캔버스/라벨 | `유틸리티 판단` / `판단 · 유틸리티` 제거 → **판단** |
| 문맥 값 | 팔레트 `변수` → **문맥 값** (ContextVariable) |
| 표시명 | HasTarget→대상 발견됨, InAttackRange→공격 범위 안, Approaching→접근 중, Dashed→대시 완료 등 (`contextLabels.ts`). 데이터 키는 그대로 |
| 레거시 예제 | Cinder Knight FSM/HFSM/BT → 기본 목록 숨김, **고급 · 레거시 예제**에서만 |
| 기본 예제 | 예제 세트 중심 = **경비 행동** (순찰→발견→경계→판단→공격/지원/후퇴) |
| 생성 UX | 알고리즘 피커 없음 유지 (이름·설명만) |
| 하단 IA | **문맥 \| 시뮬레이션 \| 검증 \| 리뷰** 유지 (Decision Trace/목표/실행기록은 시뮬 하위) |
| 검증 메시지 | Behavior Tree 문구 → 행동 패턴 루트/순환 |
| 아티팩트 요약 | `FSM·HFSM·BT 그래프` → `행동 패턴` |

## 스크린샷

`/workspace/screenshots/` 및 `docs/`:

| ID | 파일 | 내용 |
|----|------|------|
| A | `pr7-a-guard-canvas.png` | 기본 경비 Behavior Canvas |
| B | `pr7-b-decision-inspector.png` | 판단 선택 + Inspector (고려 요인 비교) |
| C | `pr7-c-decision-simulation.png` | 판단 시뮬레이션 |
| D | `pr7-d-goal-simulation.png` | 목표가 필요한 상황의 시뮬레이션 (표시명) |
| E | `pr7-e-new-behavior.png` | 새 Behavior 첫 화면 (알고리즘 피커 없음) |

## 검증 결과

| 검사 | 결과 |
|------|------|
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm test` (vitest) | **22 files / 75 tests** 통과 |
| `build.ps1 -Only pattern` | 통과 (typecheck · lint · test · build:studio) |

## 주요 파일

- `src/editor/contextLabels.ts` — 키 ↔ 표시명
- `src/editor/behaviorUi.ts` — 팔레트·캔버스 라벨
- `src/components/InspectorPanel.tsx` — 고려 요인 비교
- `src/components/HierarchyPanel.tsx` — 레거시 접기
- `src/components/GoalPlanPanel.tsx` — 목표 시뮬 표시명
- `src/editor/goapPlanner.ts` — formatFact/WorldState 표시명
- `src/editor/patternLibrary.ts` / `sampleProject.ts` — 샘플 메타
- `src/editor/languageCleanup.acceptance.test.tsx`
- `scripts/qa-pr7-language.mjs`

## 의도적 잔여 (Advanced / Legacy / 내부)

- **고급 · 레거시 예제** 안: Cinder Knight FSM / Combat HFSM / Behavior Tree 이름·데이터 유지
- 내부 타입·런타임: `decisionKind: "UTILITY"`, `goapPlanner`, XState / Mistreevous 어댑터 **삭제 없음**
- 시뮬 판단 Trace의 숫자 점수 표시는 “왜 이 행동인가” 설명용 (알고리즘 피커 아님)
- Inspector **고급**에 원문 조건식·내부 노드 유형·고유 ID

## 남은 폴리시 (알고리즘 추가 없이)

1. 하드 조건 UI의 원시 키 입력란에 표시명 힌트/autocomplete 강화
2. 문맥 테이블에 `displayName` 컬럼(선택) — 키는 고급에만
3. 판단 시뮬 카피에서 “점수”를 “비교 결과”로 더 부드럽게 (동작 동일)
4. 레거시 예제 열었을 때 상단 안내 배너(“호환용 샘플”)
