# ADR 0001: 문서 중심 전투 AI 제작 코어

상태: 승인

## 결정

- 저장 가능한 `ProjectDocument`를 제품의 유일한 원본으로 사용한다.
- React 컴포넌트는 도메인 객체를 직접 변경하지 않고 Typed Command를 보낸다.
- FSM/HFSM/BT는 같은 행동, 자산, 판단 변수 ID를 공유한다.
- 런타임은 React와 분리하며 60Hz 정수 tick, seed, 입력 로그만 사용한다.
- 첫 완성 대상은 FSM이며 HFSM은 FSM의 계층 확장으로 추가한다.

## 이유

이름을 바꿔도 참조를 보존하고, 모든 변경을 Undo/Redo하며, 저장 후 같은 결과를 재현하고,
Unity와 Unreal 변환기의 입력을 하나로 유지하기 위해서다.
