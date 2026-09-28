/**
 * 문서의 종류입니다. FSM과 HFSM은 서로 다른 문서가 아니라 같은 상태
 * 머신의 중첩 깊이 차이이므로 하나의 종류로 저장합니다.
 */
export type GraphMode = "state-machine" | "bt";
export type LegacyGraphMode = "fsm" | "hfsm";

export type GraphNodeKind =
  | "state"
  | "submachine"
  | "entry"
  | "exit"
  | "any"
  | "selector"
  | "sequence"
  | "condition"
  | "task";

export interface Point {
  x: number;
  y: number;
}

export interface GraphNode {
  /**
   * PR2 domain payload (State/Action/Decision). Optional and additive —
   * missing payload is inferred from kind via resolveDomainEntityKind().
   */
  domain?: import("./domain").NodeDomainPayload;
  id: string;
  name: string;
  kind: GraphNodeKind;
  position: Point;
  /** 상태 머신 문서에서 이 노드가 속한 편집 스코프입니다. */
  scopeId?: string;
  /** v1 파일을 읽기 위한 필드. 저장 전 마이그레이션에서 scopeId로 옮깁니다. */
  parentId?: string;
  subtitle?: string;
  action?: string;
  description?: string;
  decorators?: string[];
  actions?: StateActionBinding[];
  childScopeId?: string;
  breakpoint?: boolean;
}

export type StateActionPhase = "enter" | "update" | "exit" | "can-exit";

export interface StateActionBinding {
  id: string;
  phase: StateActionPhase;
  actionId: string;
  parameters: Record<string, string>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  priority?: number;
  accent?: "normal" | "warning" | "success";
  triggerType?: TransitionTriggerType;
  eventName?: string;
  timeoutMs?: number;
  minimumStateTimeMs?: number;
  conditionMode?: "all" | "any";
  conditions?: TransitionCondition[];
  /** 이전 저장 문서와의 호환을 위한 레거시 이벤트 필드입니다. */
  trigger?: string;
  /** 이전 저장 문서와의 호환을 위한 레거시 조건 문자열입니다. */
  guard?: string;
  interruptPolicy?: "after-action" | "source" | "immediate";
  reenter?: boolean;
}

export type TransitionTriggerType =
  | "always"
  | "condition"
  | "event"
  | "completed"
  | "timeout";

export type ConditionOperator = "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains";

export interface TransitionCondition {
  id: string;
  key: string;
  operator: ConditionOperator;
  value: string;
}

export interface GraphGroup {
  id: string;
  name: string;
  position: Point;
  width: number;
  height: number;
  parentId?: string;
  initialNodeId?: string;
  history?: "none" | "shallow" | "deep";
  regionMode?: "exclusive" | "parallel";
}

/** Unity Animator의 한 화면(루트 또는 Sub-State Machine)에 대응합니다. */
export interface StateMachineScope {
  id: string;
  name: string;
  parentScopeId?: string;
  ownerNodeId?: string;
  initialNodeId?: string;
  history: "none" | "shallow" | "deep";
  regionMode: "exclusive" | "parallel";
}

export interface GraphDefinition {
  id: string;
  mode: GraphMode;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  scopes: StateMachineScope[];
  rootScopeId?: string;
  /** v1 호환 입력 전용. v2 정규화 후에는 항상 빈 배열입니다. */
  groups: GraphGroup[];
  initialNodeId?: string;
  rootNodeId?: string;
  /**
   * Compatibility / research samples (FSM·HFSM·BT names).
   * Hidden from the default pattern list; shown under 고급 · 레거시 예제.
   */
  legacyExample?: boolean;
}

export interface BlackboardEntry {
  key: string;
  /** Planner-facing label. Prefer this in default UX; key stays for runtime/export. */
  displayName?: string;
  type: "Object" | "Float" | "Bool" | "Int" | "Vector" | "String" | "Enum";
  defaultValue: string;
  liveValue: string;
  source: string;
  enumValues?: string[];
  description?: string;
}

export interface CatalogParameter {
  id: string;
  name: string;
  type: BlackboardEntry["type"];
  defaultValue: string;
  required?: boolean;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description?: string;
  parameters: CatalogParameter[];
  unityType?: string;
  unrealType?: string;
}

export interface ConditionDefinition extends ActionDefinition {
  resultType: "Bool";
}

export interface PatternTemplate {
  id: string;
  name: string;
  description?: string;
  graph: GraphDefinition;
}

export interface TraceEvent {
  tick: number;
  time: string;
  category: "State" | "Condition" | "Action" | "Hit";
  message: string;
  entity: string;
}

export interface AssetRecord {
  id: string;
  name: string;
  type: "Character" | "Animation" | "Action" | "Graph" | "Encounter";
  path: string;
  status: "Ready" | "Missing" | "Draft";
}

export interface EditorProject {
  id: string;
  name: string;
  fileName: string;
  graphs: GraphDefinition[];
  blackboard: BlackboardEntry[];
  trace: TraceEvent[];
  assets: AssetRecord[];
}

export interface PatternSet {
  /**
   * PR2 dual-write snapshot of PatternDefinition per graph.
   * Rebuilt on save from graphs + blackboard; does not replace GraphDefinition.
   */
  patternDefinitions?: import("./domain").PatternDefinition[];
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  graphs: GraphDefinition[];
  blackboard: BlackboardEntry[];
  actions: ActionDefinition[];
  conditions: ConditionDefinition[];
  templates: PatternTemplate[];
}

export interface PatternLibrary {
  schemaVersion: 2;
  workspaceId: string;
  sets: PatternSet[];
}

/** Bottom IA: 문맥 | 시뮬레이션 | 검증 | 리뷰 (UX consolidation). Legacy tab ids removed from UI. */
export type DrawerTab = "context" | "simulation" | "validation" | "review";
export type RuntimeState = "stopped" | "playing" | "paused";

