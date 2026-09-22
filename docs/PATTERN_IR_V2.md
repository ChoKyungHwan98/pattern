# Pattern IR v2

`game-design-studio.pattern-ir` v2는 패턴 디자이너와 엔진 어댑터 사이의 단일 정본이다.

## 호환성 규칙

- `mode`는 `state-machine` 또는 `bt`만 허용한다.
- FSM은 스코프 깊이 1인 상태 머신이다. HFSM은 깊이 2 이상인 같은 문서다.
- 노드는 상태 머신에서 `scopeId`, 하위 머신 노드에서 `childScopeId`를 가진다.
- 스코프는 `parentScopeId`, `ownerNodeId`, `initialNodeId`, `history`, `regionMode`를 가진다.
- v1의 `mode=fsm|hfsm`, `groups`, `parentId`는 로드할 때 v2 스코프로 변환하고 저장할 때 다시 쓰지 않는다.
- 모든 사용자 ID·노드 위치·전환·블랙보드 값은 마이그레이션 중 보존한다. 새로 생성되는 시스템 노드와 하위 머신 소유 노드만 결정적 파생 ID를 사용한다.

## 엔진 매핑

| Pattern IR | Unity | Unreal |
|---|---|---|
| 상태 머신 문서 | PatternAsset + PatternRunner / UnityHFSM 어댑터 | UGDSPatternAsset / StateTree 어댑터 |
| 행동 트리 문서 | Unity Behavior 어댑터 | Behavior Tree |
| 블랙보드 | 직렬화 값 + 바인딩 | Blackboard/DataAsset 값 |
| 상태 행동 | IPatternAction | StateTree Task/Component binding |
| 조건 | IPatternCondition | StateTree Condition |
