# 패턴 디자이너 진행 상태

## 완료

- DevToys 계열의 스튜디오 셸에 맞춘 화면 재구성
- 상황·조건·액션 타임라인 등 엔진 용어를 드러내지 않는 행동 IDE 표면 정리
- 패턴 목록, 그래프 캔버스, 속성 패널의 3영역 구성
- 접을 수 있는 보조패널로 검증·문맥/변수 지원 패널
- React Flow 기반 편집과 Dagre 자동 배치
- XState FSM·HFSM 실행 어댑터 (호환 계층 유지)
- Mistreevous 행동 트리 실행 어댑터 (호환 계층 유지)
- 한국어 UI, 단축키 도움, 검증 결과 시각화
- **PR3 Behavior Canvas**: 상황/행동/판단 중심 표면, Entry/Any/Exit 숨김, 한글 팔레트·Inspector 도메인 편집
- **PR4 Decision System**: Decision → Candidates → Considerations → (internal Score)
  - 후보별 하드 조건(게이트) + 소프트 고려(정규화 범위·방향·영향도)
  - 흐름 조건(Situation용)과 유틸리티 기준 분리
  - Decision→Candidate Action 연결은 후보 링크(점선·무라벨, 선택)로 표시. Situation→ 흐름 조건과 구분
  - Consideration 범위는 구조화 `{ min, max, unit }`로 저장
  - 캔버스는 편집모드에서 기준만 표시 (시뮬 모드에서 실시간 점수 표시 제거 → Trace 패널로)
  - 고급 weight/curve는 영향도·방향 프리셋으로 매핑, 기본 Inspector는 숫자 숨김
- **PR5 Utility Simulation / Decision Trace** (닫힘)
  - 문맥/변수 테스트 값 → 하드 조건 게이트 → 프리셋 정규화 → 영향도 가중 평균 → max 선택
  - Decision Trace: 모든 후보 클릭 가능 · 제외(점수 없음) vs 0.00(자격 있음·미선택) 구분 · 미선택/제외 사유 표시
  - 시뮬/Trace 활성 시 선택 Decision→Action 엣지 강조·나머지 dim · 캔버스 노드에 점수 덤프하지 않음
  - 상단 `N개 문제` 원인: Decision 후보 링크를 무조건 전환 모호성 검증에서 제외 (의도치 않은 오탐 수정). 남은 문제는 배지에 메시지 직접 표시
- **PR6 Goal / Planning (GOAP 스타일)** — 의미론·작성·Plan Trace (닫힘)
  - 플래너 무결성: World State → Action 사전조건 검사 → effects 적용 → 다음 행동. 불가 시 `계획 생성 실패` + unmet (예: HasTarget=true)
  - 목표 작성: 이름 · 의도/설명 · 원하는 세계 상태(Condition Builder / 문맥 변수, 원시 표현식 기본 아님)
  - 계획 행동 작성: 이름 · 실행 조건 · 실행 결과 · 비용 (Condition Builder 재사용)
  - UI 분리: 작성(목표+계획 행동) vs 결과(World→Plan→Goal State)
  - Plan Trace 결과 구분: 계획 성공 / 이미 목표 달성 / 계획 생성 불가 / 실행 중 조건 무효화 / 재계획 필요 (+사유)
  - Utility 점수 UI 재사용 금지 · Utility→GOAP 자동 연결 없음 · HTN/EQS/AI Review 제외
  - 예제: HasTarget=true → 추적하기→대시 접근→공격 범위 진입

## 다음 후보

1. 계획 실행을 시뮬 런타임과 선택적으로 연동 (여전히 Utility와 분리)
2. 블랙보드 키를 GOAP 세계 상태와 선택 동기화
3. HFSM 경계 전환·히스토리·병렬 리전 편집 UX 강화
4. Unity·Unreal 어댑터 패키지 문서화
5. 커스텀 커브 에디터

## Product Consolidation (UX/IA) — 완료

- 하단 IA를 `문맥 | 시뮬레이션 | 검증 | 리뷰` 4탭으로 수렴
- Decision Trace / 목표·계획 / 실행기록을 시뮬레이션에 접고 선택 맥락별로 표시
- GOAP/WORLD/GOAL STATE/Preconditions/Effects 등 개발자 용어를 디자이너 언어로 치환 (고급에만 잔여)
- `goal-plan-tall` 제거 → 캔버스 높이 유지 (작성은 고급 details)
- Behavior 생성 시 FSM/HFSM/BT/Utility/GOAP 선택 UI 없음 (기존 유지)
- 내부 모델/런타임(GOAP planner, Utility sim, XState/Mistreevous) 삭제 없음
- 검증: typecheck / vitest 68 / `build.ps1 -Only pattern` / 경비 시나리오 스크린샷

## PR7 Designer Language & Product Cleanup — 완료

- 기본 UX에서 FSM/HFSM/BT/Utility/GOAP/XState/Mistreevous 표기 제거 (런타임·데이터 호환 유지)
- Inspector `고려 요인 비교`, 팔레트 `문맥 값`, 컨텍스트 키 표시명(HasTarget→대상 발견됨 등)
- 레거시 샘플은 `고급 · 레거시 예제`로 접힘. 기본 예제 중심 = 경비 행동
- 하단 4탭 유지. 검증: typecheck / lint / vitest 75 / `build.ps1 -Only pattern`
- 보고: `docs/pr7-language-cleanup-ko.md`, 스크린샷 `docs/pr7-*.png` · `/workspace/screenshots/pr7-*.png`

## PR8 Behavior Authoring Flow — 완료

- 빈 Behavior → 「첫 상황 만들기」 CTA. `+ 요소 추가` = 상황/행동/판단 (기획자 카피)
- 연결 규칙 + 「언제 이 흐름을 타는가?」 + 인라인 「새 문맥 값 만들기」 + 「어떤 상황에서도」
- 상점 NPC empty→complete 수용 테스트 + Playwright A–F (`scripts/qa-pr8-authoring.mjs`)
- 검증: typecheck / lint / vitest 83 / `build.ps1 -Only pattern`
- 문서: `docs/pr8-behavior-authoring-ko.md`, 스크린샷 `docs/pr8-*.png`
