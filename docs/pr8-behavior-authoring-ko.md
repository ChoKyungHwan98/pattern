# 패턴 디자이너 — PR8 Behavior Authoring Flow

**일시:** 2026-09-28 (KST)  
**범위:** 빈 Behavior → 상황 중심 저작 UX. 신규 알고리즘·AI Review·Utility/BT 확장·Table Designer·엔진 export **없음**.  
**원칙:** Situation / Action / Decision / Condition / ContextVariable / Interrupt **기존 모델 유지**. 기본 UX만 기획자 언어.

## 한 줄 요약

빈 행동 패턴에서 「첫 상황 만들기」로 시작해, 캔버스·Inspector만으로 **상점 NPC**(대기↔인사, 어떤 상황에서도 공격받음→도망)를 알고리즘 지식 없이 끝까지 작성·시뮬할 수 있게 했습니다. A–F 스크린샷은 **시드 fixture가 아니라** Playwright가 실제 UI로 empty→complete 저작하는 중에 캡처했습니다.

## 검증 시나리오 (상점 NPC — 경비 복제 아님)

| 흐름 | 내용 |
|------|------|
| 평소 | 대기 |
| 가까움 | 대기 → 인사 |
| 떠남 | 인사 → 대기 |
| 피격 | 어떤 상황에서도 → 도망 |

## 변경 요약

| 항목 | 내용 |
|------|------|
| 생성 직후 | 빈 캔버스 + **「첫 상황 만들기」** CTA (알고리즘/런타임 피커 없음) |
| `+ 요소 추가` | 기본 = **상황 / 행동 / 판단** (기획자 카피). 조건·문맥 값은 선/Inspector |
| 연결 UX | 상황→상황, 상황→판단, 판단→행동만 허용. 무효 연결은 작성 시 안내. **다음으로 연결** 드롭다운 |
| 연결 직후 | Inspector **「언제 이 흐름을 타는가?」** |
| 문맥 | 조건 작성 중 **「새 문맥 값 만들기」** (표시 이름 우선, 키는 고급) |
| Interrupt | **「어떤 상황에서도」** (Any State 기본 UX 비노출) |
| 하단 IA | **문맥 \| 시뮬레이션 \| 검증 \| 리뷰** 유지 |
| 버그픽스 | 문맥 값 추가 시 그래프 변경이 덮어씌워지던 stale-set 병합 수정 |

## 스크린샷 (실 UI 저작 중 캡처)

경로: `/workspace/screenshots/pr8-*.png` 및 `도구/패턴 디자이너/docs/pr8-*.png`

| ID | 파일 | 캡처 시점 |
|----|------|-----------|
| A | `pr8-a-after-create.png` | 새 Behavior 생성 직후 · 첫 상황 CTA |
| B | `pr8-b-first-situation.png` | 「첫 상황 만들기」→ 대기 |
| C | `pr8-c-connect-condition.png` | 대기→인사 연결 + 가까움 문맥 |
| D | `pr8-d-action-decision.png` | 행동·판단 추가 |
| E | `pr8-e-anywhere-interrupt.png` | 어떤 상황에서도 → 도망 + 공격받음 |
| F | `pr8-f-simulation.png` | 문맥 토글 후 시뮬레이션 |

**캡처 방법:** `scripts/qa-pr8-authoring.mjs` — 새 세트 → 빈 상점 NPC 생성 → CTA/팔레트/다음으로 연결/어떤 상황에서도/인라인 문맥 → 시뮬. 경비 fixture 미사용.

## 검증 결과

| 검사 | 결과 |
|------|------|
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm test` (vitest) | **24 files / 83 tests** 통과 (PR8 authoring 수용 테스트 포함) |
| `build.ps1 -Only pattern` | 통과 |
| Playwright QA | A–F 캡처 성공 |

## 주요 파일 (절대 경로)

- `C:\Users\Admin\Desktop\게임기획\게임기획 툴\게임기획 스튜디오\도구\패턴 디자이너\src\editor\authoringFlow.ts`
- `...\src\editor\behaviorAuthoring.acceptance.test.tsx`
- `...\src\components\GraphEditor.tsx`
- `...\src\components\TransitionInspectorPanel.tsx`
- `...\src\components\BottomPanel.tsx`
- `...\src\App.tsx`
- `...\src\editor\patternLibrary.ts` / `behaviorUi.ts` / `model.ts`
- `...\scripts\qa-pr8-authoring.mjs`
- `...\docs\pr8-behavior-authoring-ko.md`

## 의도적 잔여 / 갭

- 조건·문맥을 그래프 노드로 두는 고급 팔레트는 기본 메뉴에서 제거 (인라인 작성 유도)
- 시뮬 재생 버튼 라벨/활성 상태는 기존 크롬에 의존 — F는 문맥·시뮬 탭 전환까지 확인
- Entry/Any/Exit 데이터·XState 어댑터는 유지, 기본 캔버스·카피에만 비노출
- AI Review / 새 알고리즘 / 경비 시드 복제 **없음**
