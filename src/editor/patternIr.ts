import type { GraphDefinition, GraphEdge, PatternSet } from "./model";
import { getTransitionTriggerType, summarizeTransition } from "./transitionSemantics";

export interface PatternIrDocument {
  schema: "game-design-studio.pattern-ir";
  schemaVersion: 2;
  exportedAt: string;
  set: {
    id: string;
    name: string;
    description?: string;
    blackboard: PatternSet["blackboard"];
    actions: PatternSet["actions"];
    conditions: PatternSet["conditions"];
    templates: PatternSet["templates"];
    graphs: PatternIrGraph[];
  };
}

export interface PatternIrGraph extends Omit<GraphDefinition, "edges"> {
  edges: PatternIrEdge[];
}

export interface PatternIrEdge extends Omit<GraphEdge, "trigger" | "guard" | "label"> {
  summary: string;
  trigger: {
    type: ReturnType<typeof getTransitionTriggerType>;
    eventName?: string;
    timeoutMs?: number;
  };
}

export function createPatternIr(set: PatternSet): PatternIrDocument {
  return {
    schema: "game-design-studio.pattern-ir",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    set: {
      id: set.id,
      name: set.name,
      description: set.description,
      blackboard: structuredClone(set.blackboard),
      actions: structuredClone(set.actions),
      conditions: structuredClone(set.conditions),
      templates: structuredClone(set.templates),
      graphs: set.graphs.map((graph) => ({
        ...structuredClone(graph),
        edges: graph.edges.map(toIrEdge),
      })),
    },
  };
}

export function serializePatternIr(set: PatternSet): string {
  return JSON.stringify(createPatternIr(set), null, 2);
}

function toIrEdge(edge: GraphEdge): PatternIrEdge {
  const rest = structuredClone(edge);
  const legacyTrigger = rest.trigger;
  delete rest.trigger;
  delete rest.guard;
  delete rest.label;
  const type = getTransitionTriggerType(edge);
  return {
    ...rest,
    summary: summarizeTransition(edge),
    trigger: {
      type,
      ...(type === "event" ? { eventName: edge.eventName || legacyTrigger || edge.label } : {}),
      ...(type === "timeout" ? { timeoutMs: edge.timeoutMs ?? 0 } : {}),
    },
  };
}
