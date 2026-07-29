export type EntityId = string;
export type SpaceMode = "2d" | "3d";
export type BehaviorGraphKind = "fsm" | "hfsm" | "bt";

export type AssetKind =
  | "character"
  | "animation"
  | "weapon"
  | "effect"
  | "sound"
  | "environment";

export interface AssetRecord {
  id: EntityId;
  name: string;
  kind: AssetKind;
  path: string;
  checksum?: string;
  license?: string;
  tags: string[];
  missing?: boolean;
}

export interface ProjectMetadata {
  id: EntityId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type VariableType = "boolean" | "number" | "string";

export interface VariableDefinition {
  id: EntityId;
  key: string;
  label: string;
  type: VariableType;
  defaultValue: boolean | number | string;
}

export type SensorKey =
  | "target.visible"
  | "target.distance"
  | "target.action"
  | "self.healthRatio"
  | "self.cooldownReady"
  | "self.wasHit"
  | "self.isGuarding";

export type CompareOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export type ConditionExpr =
  | {
      kind: "compare";
      sensor: SensorKey;
      operator: CompareOperator;
      value: boolean | number | string;
    }
  | { kind: "all"; children: ConditionExpr[] }
  | { kind: "any"; children: ConditionExpr[] }
  | { kind: "not"; child: ConditionExpr };

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface StateNode {
  id: EntityId;
  name: string;
  position: CanvasPosition;
  entryActionIds: EntityId[];
  updateActionIds: EntityId[];
  exitActionIds: EntityId[];
  parentStateId?: EntityId;
}

export type InterruptPolicy = "none" | "source" | "immediate";

export interface Transition {
  id: EntityId;
  sourceStateId: EntityId;
  targetStateId: EntityId;
  conditions: ConditionExpr;
  priority: number;
  interruptPolicy: InterruptPolicy;
}

export interface FsmGraph {
  id: EntityId;
  kind: "fsm" | "hfsm";
  name: string;
  initialStateId?: EntityId;
  states: StateNode[];
  transitions: Transition[];
}

export type BtNodeKind =
  | "selector"
  | "sequence"
  | "condition"
  | "action"
  | "decorator"
  | "subtree";

export interface BehaviorTreeNode {
  id: EntityId;
  kind: BtNodeKind;
  name: string;
  position: CanvasPosition;
  children: EntityId[];
  condition?: ConditionExpr;
  actionId?: EntityId;
  subtreeId?: EntityId;
}

export interface BehaviorTree {
  id: EntityId;
  kind: "bt";
  name: string;
  rootNodeId?: EntityId;
  nodes: BehaviorTreeNode[];
}

export type BehaviorGraph = FsmGraph | BehaviorTree;

export type TimelineTrackKind =
  | "animation"
  | "movement"
  | "collision"
  | "projectile"
  | "cancel"
  | "effect"
  | "sound"
  | "camera"
  | "hitStop"
  | "event";

export interface TimelineTrack {
  id: EntityId;
  kind: TimelineTrackKind;
  name: string;
  locked: boolean;
  muted: boolean;
}

export type CollisionRole =
  | "telegraph"
  | "attack"
  | "hurt"
  | "physics"
  | "sense"
  | "guard"
  | "parry";

export type Shape2D =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "capsule"; radius: number; length: number }
  | { kind: "sector"; radius: number; angleDegrees: number }
  | { kind: "ray"; length: number; thickness: number };

export type Shape3D =
  | { kind: "sphere"; radius: number }
  | { kind: "box"; width: number; height: number; depth: number }
  | { kind: "capsule"; radius: number; length: number }
  | { kind: "cylinder"; radius: number; height: number }
  | { kind: "cone"; radius: number; height: number }
  | { kind: "ray"; length: number; thickness: number };

export interface LocalTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface TimelineItemBase {
  id: EntityId;
  trackId: EntityId;
  name: string;
  startTick: number;
  endTick: number;
}

export interface AnimationTimelineItem extends TimelineItemBase {
  type: "animation";
  assetId?: EntityId;
  playbackRate: number;
  loop: boolean;
}

export interface MovementTimelineItem extends TimelineItemBase {
  type: "movement";
  distance: number;
  directionDegrees: number;
}

export interface CollisionTimelineItem extends TimelineItemBase {
  type: "collision";
  role: CollisionRole;
  socket: string;
  transform: LocalTransform;
  shape2d?: Shape2D;
  shape3d?: Shape3D;
  continuous: boolean;
  damage: number;
}

export interface ProjectileTimelineItem extends TimelineItemBase {
  type: "projectile";
  socket: string;
  speed: number;
  lifetimeTicks: number;
  gravity: number;
  damage: number;
  collisionRadius: number;
  assetId?: EntityId;
}

export interface DefenseTimelineItem extends TimelineItemBase {
  type: "defense";
  role: "guard" | "parry" | "dodge";
  angleDegrees: number;
  damageMultiplier: number;
}

export interface SimpleTimelineItem extends TimelineItemBase {
  type: "cancel" | "effect" | "sound" | "camera" | "hitStop" | "event";
  payload?: Record<string, boolean | number | string>;
}

export type TimelineItem =
  | AnimationTimelineItem
  | MovementTimelineItem
  | CollisionTimelineItem
  | ProjectileTimelineItem
  | DefenseTimelineItem
  | SimpleTimelineItem;

export interface ActionDefinition {
  id: EntityId;
  name: string;
  durationTicks: number;
  tickRate: 60;
  tracks: TimelineTrack[];
  items: TimelineItem[];
}

export interface ActorDefinition {
  id: EntityId;
  name: string;
  characterAssetId?: EntityId;
  graphId?: EntityId;
  defaultActionId?: EntityId;
  isPlayerControlled: boolean;
}

export interface TestScene {
  id: EntityId;
  name: string;
  actorIds: EntityId[];
  seed: number;
}

export interface EditorViewState {
  workspace: "resources" | "actions" | "ai" | "experiment" | "analysis";
  selectedAssetId?: EntityId;
  selectedActionId?: EntityId;
  selectedGraphId?: EntityId;
  selectedStateId?: EntityId;
  selectedTransitionId?: EntityId;
  selectedTimelineItemIds: EntityId[];
  timelineZoom: number;
}

export interface ProjectDocument {
  schemaVersion: 1;
  project: ProjectMetadata;
  spaceMode: SpaceMode;
  assets: AssetRecord[];
  variables: VariableDefinition[];
  actors: ActorDefinition[];
  actions: ActionDefinition[];
  behaviorGraphs: BehaviorGraph[];
  testScenes: TestScene[];
  editor: EditorViewState;
}

export function createId(prefix: string): EntityId {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
}
