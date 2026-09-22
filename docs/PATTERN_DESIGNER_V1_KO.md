# 패턴 디자이너 v1 설계·검증 기록

## 제품 정의

패턴 디자이너는 FSM과 HFSM을 별도 도구로 나누지 않는다. 상태 머신 문서는 루트 스코프에서 시작하며, 하위 상태 머신을 추가하는 순간 자연스럽게 HFSM이 된다. 행동 트리는 실행 규칙이 다르기 때문에 별도 문서 종류로 유지한다.

## 핵심 구조

- Pattern Library v2가 로컬 정본이다.
- 상태 머신 문서: `GraphDefinition(mode=state-machine)` → `StateMachineScope[]` → 상태·하위 머신·Entry·Any State·Exit.
- 행동 트리 문서: `GraphDefinition(mode=bt)` → Selector·Sequence·Condition·Task.
- 엔진별 형식은 Pattern IR v2에서 파생한다. Unity와 Unreal 데이터가 원본을 역으로 오염시키지 않는다.
- v1 FSM/HFSM 파일은 최초 로드 시 원문 백업을 남긴 뒤 v2로 변환한다.

## 완성 범위

1. FSM/HFSM 통합 및 v1→v2 마이그레이션.
2. Unity Animator 방식 하위 머신 생성, 더블클릭 진입, breadcrumb, Entry/Any/Exit, 우클릭 편집.
3. 최소 체류 시간, 완료·이벤트·조건·시간 전환, 인터럽트, 얕은/깊은 기록, 병렬 리전 데이터 및 검증.
4. Bool/Int/Float/String/Vector/Object/Enum 블랙보드, 행동·조건 카탈로그, On Enter/Update/Exit/Can Exit 바인딩.
5. 로컬 시뮬레이터, 계층 활성 경로, 이벤트 주입, 중단점, 커버리지, 상태 체류 시간, 실패 조건, 결정적 재생.
6. Unity 6 UPM ZIP: ScriptedImporter, PatternAsset, PatternRunner, 바인딩 인터페이스, Debug Window, Runtime/Editor 테스트, Sample.
7. Unreal 플러그인 ZIP: Runtime/Editor 모듈, DataAsset, ActorComponent, `.gpattern` Factory, 자동화 테스트, Sample.
8. 그래프 이름 변경·복제·2단계 삭제, 2단계 저장·복구 저널, 진단 보고서, 반응형 UI, 자동 테스트와 통합 빌드.

## 포트폴리오 시연 순서

1. 새 상태 머신을 만든다. FSM/HFSM 선택이 없음을 설명한다.
2. `Locomotion` 상태와 `Combat` 하위 머신을 만든다.
3. `Combat`을 더블클릭하고 `Entry → Select Attack → Heavy Attack → Exit`를 만든다.
4. 블랙보드에 `DistanceToTarget`, `CooldownReady`를 추가하고 조건 전환을 편집한다.
5. 행동 카탈로그에서 Unity C#·Unreal C++ 바인딩 이름을 지정한다.
6. 중단점을 켜고 실행하여 활성 계층·실패 조건·커버리지·되감기를 보여준다.
7. Unity UPM과 Unreal Plugin ZIP을 내보내고 내부 폴더를 보여준다.
8. 진단 보고서로 오류 0, 누락 바인딩 0, 엔진 준비 상태를 제시한다.

## 알려진 검증 경계

현재 자동 검증은 TypeScript 런타임, ZIP 구조와 생성 소스까지 담당한다. 실제 Unity 6 Editor 컴파일과 Unreal Engine C++ 빌드는 해당 엔진이 설치된 환경에서 마지막으로 실행해야 한다. 엔진 실기 검증 전에는 “엔진 연동 완료”가 아니라 “설치 가능한 어댑터 패키지 생성 완료”라고 표현한다.
