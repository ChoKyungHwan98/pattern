import type { BlackboardEntry, GraphDefinition, RuntimeState, TraceEvent } from "../editor/model";

export type RuntimeEngine = "XState" | "Mistreevous";
export type RuntimeNodeState = "ready" | "active" | "running" | "success" | "failure";

export interface PatternRuntimeSnapshot {
  engine: RuntimeEngine;
  state: RuntimeState;
  tick: number;
  activeNodeId?: string;
  activePath?: string[];
  lastSignal?: string;
  lastTransitionId?: string;
  breakpointHit?: string;
  coverage: Record<string, number>;
  stateDurationsMs: Record<string, number>;
  failedConditions: Array<{ edgeId: string; reason: string }>;
  replay: Array<{ tick: number; eventName?: string }>;
  nodeStates: Record<string, RuntimeNodeState>;
  trace: TraceEvent[];
}

export interface PatternRuntime {
  readonly graph: GraphDefinition;
  readonly blackboard: BlackboardEntry[];
  getSnapshot(): PatternRuntimeSnapshot;
  step(eventName?: string): PatternRuntimeSnapshot;
  seek(tick: number): PatternRuntimeSnapshot;
  setBlackboardValue(key: string, value: string): PatternRuntimeSnapshot;
  reset(): PatternRuntimeSnapshot;
  dispose(): void;
}

export function runtimeTrace(
  tick: number,
  message: string,
  entity: string,
  category: TraceEvent["category"] = "State",
): TraceEvent {
  return {
    tick,
    time: (tick / 60).toFixed(3),
    category,
    message,
    entity,
  };
}
