import type { GraphDefinition, GraphEdge, PatternSet } from "../editor/model";
import { getTransitionTriggerType, summarizeTransition } from "../editor/transitionSemantics";

export type EngineExportTarget = "unity" | "unreal";

export interface EngineImportManifest {
  schema: "game-design-studio.engine-import";
  schemaVersion: 2;
  exportedAt: string;
  target: {
    engine: "Unity" | "Unreal Engine";
    adapter: "UnityHFSM + Unity Behavior" | "StateTree + Behavior Tree";
    requiredModules: string[];
  };
  patternSet: {
    id: string;
    name: string;
    blackboard: Array<{
      key: string;
      type: string;
      defaultValue: string;
    }>;
    graphs: EngineGraphManifest[];
  };
}

export interface EngineGraphManifest {
  id: string;
  name: string;
  sourceMode: GraphDefinition["mode"];
  assetKind: string;
  entryId?: string;
  nodes: GraphDefinition["nodes"];
  scopes: GraphDefinition["scopes"];
  transitions: Array<{
    id: string;
    source: string;
    target: string;
    trigger: ReturnType<typeof getTransitionTriggerType>;
    eventName?: string;
    timeoutMs?: number;
    conditions: NonNullable<GraphEdge["conditions"]>;
    conditionMode: "all" | "any";
    priority: number;
    interruptPolicy: NonNullable<GraphEdge["interruptPolicy"]>;
    displayName: string;
  }>;
}

export function createEngineImportManifest(set: PatternSet, target: EngineExportTarget): EngineImportManifest {
  return {
    schema: "game-design-studio.engine-import",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    target: targetDescription(target),
    patternSet: {
      id: set.id,
      name: set.name,
      blackboard: set.blackboard.map((entry) => ({
        key: entry.key,
        type: mapBlackboardType(entry.type, target),
        defaultValue: entry.defaultValue,
      })),
      graphs: set.graphs.map((graph) => toGraphManifest(graph, target)),
    },
  };
}

export function serializeEngineImportManifest(set: PatternSet, target: EngineExportTarget): string {
  return JSON.stringify(createEngineImportManifest(set, target), null, 2);
}

function targetDescription(target: EngineExportTarget): EngineImportManifest["target"] {
  if (target === "unity") {
    return {
      engine: "Unity",
      adapter: "UnityHFSM + Unity Behavior",
      requiredModules: ["com.inspiaaa.unityhfsm", "com.unity.behavior"],
    };
  }
  return {
    engine: "Unreal Engine",
    adapter: "StateTree + Behavior Tree",
    requiredModules: ["StateTree", "GameplayStateTree", "AIModule"],
  };
}

function toGraphManifest(graph: GraphDefinition, target: EngineExportTarget): EngineGraphManifest {
  return {
    id: graph.id,
    name: graph.name,
    sourceMode: graph.mode,
    assetKind: graph.mode === "bt"
      ? target === "unity" ? "UnityBehaviorGraph" : "BehaviorTree"
      : target === "unity" ? "UnityHFSM" : "StateTree",
    entryId: graph.rootNodeId ?? graph.initialNodeId,
    nodes: structuredClone(graph.nodes),
    scopes: structuredClone(graph.scopes),
    transitions: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      trigger: getTransitionTriggerType(edge),
      eventName: edge.eventName ?? edge.trigger ?? (getTransitionTriggerType(edge) === "event" ? edge.label : undefined),
      timeoutMs: edge.timeoutMs,
      conditions: structuredClone(edge.conditions ?? []),
      conditionMode: edge.conditionMode ?? "all",
      priority: edge.priority ?? 0,
      interruptPolicy: edge.interruptPolicy ?? "after-action",
      displayName: summarizeTransition(edge),
    })),
  };
}

function mapBlackboardType(type: PatternSet["blackboard"][number]["type"], target: EngineExportTarget): string {
  if (target === "unity") {
    return ({ Object: "UnityEngine.Object", Float: "System.Single", Bool: "System.Boolean", Int: "System.Int32", Vector: "UnityEngine.Vector3", String: "System.String", Enum: "System.String" } as const)[type];
  }
  return ({ Object: "UObject", Float: "Float", Bool: "Bool", Int: "Int", Vector: "Vector", String: "String", Enum: "Name" } as const)[type];
}
