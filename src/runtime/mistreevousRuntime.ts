import { BehaviourTree, State, type NodeDetails } from "mistreevous";
import type { BlackboardEntry, GraphDefinition, GraphNode } from "../editor/model";
import type { PatternRuntime, PatternRuntimeSnapshot, RuntimeNodeState } from "./types";
import { runtimeTrace } from "./types";

type Definition = Record<string, unknown>;

export class MistreevousPatternRuntime implements PatternRuntime {
  readonly graph: GraphDefinition;
  readonly blackboard: BlackboardEntry[];
  private tree: BehaviourTree;
  private runningActions = new Set<string>();
  private latestNodeId?: string;
  private snapshot: PatternRuntimeSnapshot;

  constructor(graph: GraphDefinition, blackboard: BlackboardEntry[] = []) {
    this.graph = graph;
    this.blackboard = structuredClone(blackboard);
    this.tree = this.createTree();
    this.snapshot = this.createInitialSnapshot();
  }

  getSnapshot(): PatternRuntimeSnapshot {
    return {
      ...this.snapshot,
      activePath: this.snapshot.activePath ? [...this.snapshot.activePath] : [],
      nodeStates: { ...this.snapshot.nodeStates },
      coverage: { ...this.snapshot.coverage },
      stateDurationsMs: { ...this.snapshot.stateDurationsMs },
      failedConditions: [...this.snapshot.failedConditions],
      replay: [...this.snapshot.replay],
      trace: [...this.snapshot.trace],
    };
  }

  step(): PatternRuntimeSnapshot {
    this.latestNodeId = undefined;
    this.tree.step();
    const tick = this.snapshot.tick + 1;
    const details = this.tree.getTreeNodeDetails();
    const nodeStates = collectNodeStates(details);
    const activeNodeId = findRunningNode(details) ?? this.latestNodeId;
    const activeName = activeNodeId
      ? this.graph.nodes.find((node) => node.id === activeNodeId)?.name ?? activeNodeId
      : "행동 트리";
    this.snapshot = {
      engine: "Mistreevous",
      state: "paused",
      tick,
      activeNodeId,
      lastSignal: this.tree.getState(),
      breakpointHit: activeNodeId && this.graph.nodes.find((node) => node.id === activeNodeId)?.breakpoint ? activeNodeId : undefined,
      coverage: activeNodeId ? { ...this.snapshot.coverage, [activeNodeId]: (this.snapshot.coverage[activeNodeId] ?? 0) + 1 } : { ...this.snapshot.coverage },
      stateDurationsMs: activeNodeId ? { ...this.snapshot.stateDurationsMs, [activeNodeId]: (this.snapshot.stateDurationsMs[activeNodeId] ?? 0) + 16.667 } : { ...this.snapshot.stateDurationsMs },
      failedConditions: [],
      replay: [...this.snapshot.replay, { tick }],
      nodeStates: Object.fromEntries(
        this.graph.nodes.map((node) => [node.id, nodeStates[node.id] ?? "ready"]),
      ),
      trace: [
        ...this.snapshot.trace.slice(-199),
        runtimeTrace(tick, `${activeName} 평가`, activeNodeId ?? this.graph.id, "Action"),
      ],
    };
    return this.getSnapshot();
  }

  reset(): PatternRuntimeSnapshot {
    this.runningActions.clear();
    this.latestNodeId = undefined;
    this.tree = this.createTree();
    this.snapshot = this.createInitialSnapshot();
    return this.getSnapshot();
  }

  seek(tick: number): PatternRuntimeSnapshot {
    const count = Math.min(this.snapshot.replay.length, Math.max(0, tick));
    this.reset();
    for (let index = 0; index < count; index += 1) this.step();
    this.snapshot = { ...this.snapshot, state: "paused" };
    return this.getSnapshot();
  }

  setBlackboardValue(key: string, value: string): PatternRuntimeSnapshot {
    const entry = this.blackboard.find((item) => item.key === key);
    if (entry) entry.liveValue = value;
    return this.getSnapshot();
  }

  dispose(): void {
    this.tree.reset();
  }

  private createInitialSnapshot(): PatternRuntimeSnapshot {
    return {
      engine: "Mistreevous",
      state: "stopped",
      tick: 0,
      activeNodeId: this.graph.rootNodeId,
      activePath: this.graph.rootNodeId ? [this.graph.rootNodeId] : [],
      coverage: {},
      stateDurationsMs: {},
      failedConditions: [],
      replay: [],
      nodeStates: Object.fromEntries(
        this.graph.nodes.map((node) => [node.id, "ready" as RuntimeNodeState]),
      ),
      trace: this.graph.rootNodeId
        ? [runtimeTrace(0, "행동 트리 준비", this.graph.rootNodeId)]
        : [],
    };
  }

  private createTree(): BehaviourTree {
    const root = this.graph.nodes.find((node) => node.id === this.graph.rootNodeId);
    if (!root) throw new Error("행동 트리에 루트 노드가 없습니다.");

    const agent = {
      __condition: (nodeId: string) => {
        this.latestNodeId = nodeId;
        return true;
      },
      __action: (nodeId: string) => {
        this.latestNodeId = nodeId;
        if (!this.runningActions.has(nodeId)) {
          this.runningActions.add(nodeId);
          return State.RUNNING;
        }
        this.runningActions.delete(nodeId);
        return State.SUCCEEDED;
      },
    };

    const definition = {
      type: "root",
      child: buildDefinition(this.graph, root),
    };
    return new BehaviourTree(definition as never, agent, {
      getDeltaTime: () => 1 / 60,
    });
  }
}

function buildDefinition(graph: GraphDefinition, node: GraphNode): Definition {
  const children = graph.edges
    .filter((edge) => edge.source === node.id)
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))
    .map((edge) => graph.nodes.find((candidate) => candidate.id === edge.target))
    .filter((candidate): candidate is GraphNode => Boolean(candidate));

  if (node.kind === "selector" || node.kind === "sequence") {
    if (children.length === 0) {
      return { type: "action", call: "__action", args: [node.id] };
    }
    return {
      type: node.kind,
      children: children.map((child) => buildDefinition(graph, child)),
    };
  }
  if (node.kind === "condition") {
    return { type: "condition", call: "__condition", args: [node.id] };
  }
  return { type: "action", call: "__action", args: [node.id] };
}

function collectNodeStates(details: NodeDetails): Record<string, RuntimeNodeState> {
  const result: Record<string, RuntimeNodeState> = {};
  const visit = (node: NodeDetails) => {
    const sourceId = typeof node.args?.[0] === "string" ? node.args[0] : undefined;
    if (sourceId) result[sourceId] = toRuntimeState(node.state);
    node.children?.forEach(visit);
  };
  visit(details);
  return result;
}

function findRunningNode(details: NodeDetails): string | undefined {
  let result: string | undefined;
  const visit = (node: NodeDetails) => {
    if (node.state === State.RUNNING && typeof node.args?.[0] === "string") {
      result = node.args[0];
    }
    node.children?.forEach(visit);
  };
  visit(details);
  return result;
}

function toRuntimeState(state: State): RuntimeNodeState {
  if (state === State.RUNNING) return "running";
  if (state === State.SUCCEEDED) return "success";
  if (state === State.FAILED) return "failure";
  return "ready";
}
