# FSM·HFSM·Behavior Tree GitHub 조사

조사일: 2026-08-12

## 현재 패턴 디자이너 진단

현재 작업 트리는 완성된 제작 도구보다 에디터 셸과 샘플 프로젝트에 가깝다.

- FSM, HFSM, Behavior Tree 화면 전환과 도킹 패널은 구현돼 있다.
- 노드 선택·이동, Inspector, Blackboard, Trace의 시각적 연결은 있다.
- 기존 수동 `div + svg` 캔버스는 노드 추가·연결·자동 배치 버튼이 실제 동작하지 않았다.
- 현재 모델은 HFSM 그룹을 한 단계만 표현하며 시작 상태, 중첩 초기 상태, 히스토리,
  병렬 리전, 전환 가드와 실행 시점을 정식 데이터로 갖지 않는다.
- 현재 재생 기능은 노드를 순서대로 순환하는 데모다. 설계된 조건을 평가하는 런타임이 아니다.
- Git의 현재 `HEAD`에는 지금 작업 트리에서 삭제된 버전형 프로젝트 스키마,
  명령 처리기, FSM 검증기, 결정론적 FSM 런타임과 React Flow 기반 편집기가 남아 있다.
  따라서 외부 코드를 크게 복사하기 전에 이 내부 자산을 재조합하는 편이 안전하다.

## 조사 결과

별 수와 최근 갱신일은 조사일의 GitHub API 결과다.

| 저장소 | 별 | 라이선스 | 판단 | 가져올 내용 |
|---|---:|---|---|---|
| [xyflow/xyflow](https://github.com/xyflow/xyflow) | 37,987 | MIT | 채택 | React 19 그래프 캔버스, 포트 연결, 서브플로, 미니맵 |
| [dagrejs/dagre](https://github.com/dagrejs/dagre) | 5,755 | MIT | 채택 | FSM·BT 자동 배치의 첫 구현 |
| [statelyai/xstate](https://github.com/statelyai/xstate) | 30,000 | MIT | 의미론 참고 | 중첩·병렬·히스토리 상태, 가드, 이벤트, 상태차트 검증 |
| [retejs/rete](https://github.com/retejs/rete) | 12,132 | MIT | 보류 | 데이터플로 편집에는 강하지만 FSM용으로는 플러그인 층이 과함 |
| [BehaviorTree/BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP) | 4,156 | MIT | 실행 어댑터 후보 | 비동기 액션, 포트형 데이터 전달, XML 런타임 포맷, 기록·재생 |
| [limbonaut/limboai](https://github.com/limbonaut/limboai) | 2,945 | MIT | UX·모델 참고 | BT 서브트리, Blackboard scope, 실행 중 시각 디버깅, HSM+BT 결합 |
| [bitbrain/beehave](https://github.com/bitbrain/beehave) | 3,222 | MIT | UX 참고 | 실행 경로 강조, 성능 모니터, 테스트 중심 BT 구성 |
| [Inspiaaa/UnityHFSM](https://github.com/Inspiaaa/UnityHFSM) | 1,595 | MIT | Unity 출력 참고 | 중첩 머신, exit time, pending transition, 활성 계층 경로 |
| [StateSmith/StateSmith](https://github.com/StateSmith/StateSmith) | 936 | Apache-2.0 | 코드 생성 참고 | 다중 언어 생성, 도식과 생성 코드의 단일 원본 원칙 |
| [behavior3/behavior3editor](https://github.com/behavior3/behavior3editor) | 704 | MIT | 포맷만 참고 | 사용자 노드 카탈로그, JSON import/export. 구현은 2022년 이후 정체 |
| [andrew-gresyk/HFSM2](https://github.com/andrew-gresyk/HFSM2) | 626 | MIT | C++ 런타임 후보 | 정적 무할당 HFSM, 복합·병렬 리전, 직렬화, 실행 이력 |

## 이번에 실제로 반영한 것

1. `@xyflow/react 12.11.1`
   - 노드 드래그, 캔버스 이동·확대, 포트 연결, 선택, 미니맵을 실제 동작으로 교체했다.
   - HFSM 그룹을 React Flow의 부모 노드로 변환하되 기존 절대 좌표 모델은 유지한다.
2. `@dagrejs/dagre 1.1.5`
   - FSM과 BT는 방향성 그래프로 자동 배치한다.
   - HFSM은 그룹별 자식 노드를 별도로 배치해 부모 영역을 보존한다.
3. 자동 검증
   - 브라우저 렌더링, HFSM 표시, 노드 추가, 자동 배치를 무창 테스트한다.

## 다음 구현 순서

1. 현재 `HEAD`에 남은 버전형 프로젝트 스키마·명령·저장소·검증기를 새 UI 아래로 복구한다.
2. XState와 UnityHFSM을 기준으로 `initial`, `history`, `parallel region`, `exit time`,
   `guard`, `event`, `interrupt policy`를 엔진 중립 스키마로 확정한다.
3. 플랫 FSM 런타임을 계층 경로 기반 HFSM 런타임으로 확장하고 60Hz 결정론 테스트를 만든다.
4. BehaviorTree.CPP와 LimboAI를 기준으로 BT 노드 상태 `Idle/Running/Success/Failure`,
   포트, Blackboard scope, subtree를 추가한다.
5. Unity C#·Unreal C++·BehaviorTree.CPP XML은 코어 문서에서 생성하는 어댑터로 분리한다.

외부 프로젝트의 화면 전체나 실행 코드를 복사하지 않는다. MIT 의존성은 패키지로 사용하고,
나머지는 데이터 의미론·검증 항목·상호작용 패턴만 참고해 엔진 중립 코어로 다시 구현한다.

