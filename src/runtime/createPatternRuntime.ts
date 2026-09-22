import type { BlackboardEntry, GraphDefinition } from "../editor/model";
import { MistreevousPatternRuntime } from "./mistreevousRuntime";
import type { PatternRuntime } from "./types";
import { XStatePatternRuntime } from "./xstateRuntime";

export function createPatternRuntime(graph: GraphDefinition, blackboard: BlackboardEntry[] = []): PatternRuntime {
  return graph.mode === "bt"
    ? new MistreevousPatternRuntime(graph, blackboard)
    : new XStatePatternRuntime(graph, blackboard);
}
