import { createActor, createMachine } from "xstate";
import type { BlackboardEntry, GraphDefinition, GraphEdge, GraphNode, StateMachineScope } from "../editor/model";
import { getTransitionTriggerType, isTransitionEligible, summarizeTransition } from "../editor/transitionSemantics";
import type { PatternRuntime, PatternRuntimeSnapshot, RuntimeNodeState } from "./types";
import { runtimeTrace } from "./types";

type TransitionConfig = { target: string };

interface StateConfig {
  id: string;
  type?: "parallel" | "history";
  history?: "shallow" | "deep";
  initial?: string;
  states?: Record<string, StateConfig>;
  on?: Record<string, TransitionConfig | TransitionConfig[]>;
}

interface MachineConfig extends StateConfig {
  initial: string;
  states: Record<string, StateConfig>;
}

interface ActorSnapshot { value: unknown }
interface ActorLike {
  start(): unknown;
  stop(): unknown;
  send(event: { type: string }): void;
  getSnapshot(): ActorSnapshot;
}

export class XStatePatternRuntime implements PatternRuntime {
  readonly graph: GraphDefinition;
  readonly blackboard: BlackboardEntry[];
  private actor: ActorLike;
  private snapshot: PatternRuntimeSnapshot;
  private stateEnteredAtTick = 0;

  constructor(graph: GraphDefinition, blackboard: BlackboardEntry[] = []) {
    this.graph = graph;
    this.blackboard = structuredClone(blackboard);
    this.actor = this.createActor();
    this.snapshot = this.createInitialSnapshot();
  }

  getSnapshot(): PatternRuntimeSnapshot { return cloneSnapshot(this.snapshot); }

  step(eventName?: string): PatternRuntimeSnapshot {
    const activeNodeId = this.readActiveNodeId();
    const activePath = activeNodeId ? getActivePath(this.graph, activeNodeId) : [];
    const candidateSources = new Set(activePath);
    activePath.forEach((nodeId) => {
      const node = this.graph.nodes.find((item) => item.id === nodeId);
      if (!node?.scopeId) return;
      this.graph.nodes.filter((item) => item.scopeId === node.scopeId && item.kind === "any")
        .forEach((item) => candidateSources.add(item.id));
    });
    const evaluationContext = {
      eventName,
      elapsedMs: (this.snapshot.tick - this.stateEnteredAtTick + 1) * 100,
      completed: (this.snapshot.tick - this.stateEnteredAtTick + 1) * 100 >= 100,
    };
    const candidates = this.graph.edges
      .filter((edge) => candidateSources.has(edge.source))
      .sort(compareTransitions);
    const failedConditions = candidates
      .filter((edge) => !isTransitionEligible(edge, this.blackboard, evaluationContext))
      .map((edge) => ({ edgeId: edge.id, reason: `${summarizeTransition(edge)} 조건 불충족` }));
    let transition = candidates.filter((edge) => isTransitionEligible(edge, this.blackboard, evaluationContext))[0];
    const tick = this.snapshot.tick + 1;

    if (!transition) {
      this.snapshot = {
        ...this.snapshot,
        state: "paused",
        tick,
        failedConditions,
        replay: [...this.snapshot.replay, { tick, ...(eventName ? { eventName } : {}) }],
        trace: [...this.snapshot.trace.slice(-499), runtimeTrace(
          tick,
          eventName ? `“${eventName}” 이벤트에 실행 가능한 전환이 없습니다.` : "조건을 만족하는 전환이 없습니다.",
          activeNodeId ?? this.graph.id,
          "Condition",
        )],
      };
      return this.getSnapshot();
    }

    transition = resolveExitTransition(this.graph, transition, this.blackboard, eventName) ?? transition;
    this.actor.send({ type: transitionSignal(transition) });
    const nextNodeId = this.readActiveNodeId();
    if (nextNodeId !== activeNodeId) this.stateEnteredAtTick = tick;
    const nodeStates = createNodeStates(this.graph, nextNodeId);
    const coverage = { ...this.snapshot.coverage };
    if (nextNodeId) coverage[nextNodeId] = (coverage[nextNodeId] ?? 0) + 1;
    const stateDurationsMs = { ...this.snapshot.stateDurationsMs };
    if (activeNodeId) stateDurationsMs[activeNodeId] = (stateDurationsMs[activeNodeId] ?? 0) + evaluationContext.elapsedMs;
    const breakpointHit = nextNodeId && this.graph.nodes.find((node) => node.id === nextNodeId)?.breakpoint ? nextNodeId : undefined;
    this.snapshot = {
      ...this.snapshot,
      state: "paused",
      tick,
      activeNodeId: nextNodeId,
      activePath: nextNodeId ? getActivePath(this.graph, nextNodeId) : [],
      lastSignal: summarizeTransition(transition),
      lastTransitionId: transition.id,
      breakpointHit,
      coverage,
      stateDurationsMs,
      failedConditions,
      replay: [...this.snapshot.replay, { tick, ...(eventName ? { eventName } : {}) }],
      nodeStates,
      trace: [...this.snapshot.trace.slice(-499), runtimeTrace(
        tick,
        `${nodeName(this.graph, transition.source)} → ${nodeName(this.graph, transition.target)} 전환`,
        transition.id,
        "State",
      )],
    };
    return this.getSnapshot();
  }

  reset(): PatternRuntimeSnapshot {
    this.actor.stop();
    this.actor = this.createActor();
    this.stateEnteredAtTick = 0;
    this.snapshot = this.createInitialSnapshot();
    return this.getSnapshot();
  }

  seek(tick: number): PatternRuntimeSnapshot {
    const replay = this.snapshot.replay.filter((entry) => entry.tick <= Math.max(0, tick));
    this.reset();
    replay.forEach((entry) => this.step(entry.eventName));
    this.snapshot = { ...this.snapshot, state: "paused" };
    return this.getSnapshot();
  }

  setBlackboardValue(key: string, value: string): PatternRuntimeSnapshot {
    const entry = this.blackboard.find((item) => item.key === key);
    if (entry) entry.liveValue = value;
    this.snapshot = {
      ...this.snapshot,
      trace: [...this.snapshot.trace.slice(-499), runtimeTrace(this.snapshot.tick, `${key} = ${value}`, key, "Condition")],
    };
    return this.getSnapshot();
  }

  dispose(): void { this.actor.stop(); }

  private createActor(): ActorLike {
    const machine = createMachine(buildMachineConfig(this.graph) as never);
    const actor = createActor(machine) as ActorLike;
    actor.start();
    return actor;
  }

  private createInitialSnapshot(): PatternRuntimeSnapshot {
    const activeNodeId = this.readActiveNodeId();
    return {
      engine: "XState",
      state: "stopped",
      tick: 0,
      activeNodeId,
      activePath: activeNodeId ? getActivePath(this.graph, activeNodeId) : [],
      coverage: activeNodeId ? { [activeNodeId]: 1 } : {},
      stateDurationsMs: {},
      failedConditions: [],
      replay: [],
      nodeStates: createNodeStates(this.graph, activeNodeId),
      trace: activeNodeId ? [runtimeTrace(0, `${nodeName(this.graph, activeNodeId)} 시작`, activeNodeId)] : [],
    };
  }

  private readActiveNodeId(): string | undefined {
    const stateIds = flattenStateValue(this.actor.getSnapshot().value);
    return [...stateIds].reverse().find((id) => this.graph.nodes.some((node) => node.id === id && node.kind === "state"))
      ?? stateIds.find((id) => this.graph.nodes.some((node) => node.id === id));
  }
}

function buildMachineConfig(graph: GraphDefinition): MachineConfig {
  const root = graph.scopes.find((scope) => scope.id === graph.rootScopeId)
    ?? graph.scopes.find((scope) => !scope.parentScopeId);
  if (!root) throw new Error("상태 머신의 루트 스코프가 없습니다.");
  const content = buildScopeContent(graph, root);
  if (!content.initial) throw new Error("상태 머신의 시작 상태가 없습니다.");
  return { id: graph.id, initial: content.initial, states: content.states, on: content.on };
}

function buildScopeContent(graph: GraphDefinition, scope: StateMachineScope): {
  initial?: string;
  states: Record<string, StateConfig>;
  on?: Record<string, TransitionConfig | TransitionConfig[]>;
} {
  const nodes = graph.nodes.filter((node) => node.scopeId === scope.id && (node.kind === "state" || node.kind === "submachine"));
  const states = Object.fromEntries(nodes.map((node) => [node.id, buildNodeState(graph, node)]));
  const initial = nodes.some((node) => node.id === scope.initialNodeId) ? scope.initialNodeId : nodes[0]?.id;
  const anyIds = new Set(graph.nodes.filter((node) => node.scopeId === scope.id && node.kind === "any").map((node) => node.id));
  return { initial, states, on: buildTransitions(graph, graph.edges.filter((edge) => anyIds.has(edge.source))) };
}

function buildNodeState(graph: GraphDefinition, node: GraphNode): StateConfig {
  const childScope = node.childScopeId ? graph.scopes.find((scope) => scope.id === node.childScopeId) : undefined;
  const ownTransitions = graph.edges.filter((edge) => edge.source === node.id);
  if (!childScope) return { id: node.id, on: buildTransitions(graph, ownTransitions) };
  const child = buildScopeContent(graph, childScope);
  const historyState: Record<string, StateConfig> = childScope.history === "none" ? {} : {
    __history: { id: `${childScope.id}:history`, type: "history" as const, history: childScope.history },
  };
  return {
    id: node.id,
    ...(childScope.regionMode === "parallel" ? { type: "parallel" as const } : { initial: child.initial }),
    states: { ...child.states, ...historyState },
    on: mergeTransitionMaps(child.on, buildTransitions(graph, ownTransitions)),
  };
}

function buildTransitions(graph: GraphDefinition, edges: GraphEdge[]): Record<string, TransitionConfig | TransitionConfig[]> | undefined {
  const bySignal = new Map<string, TransitionConfig[]>();
  [...edges].sort(compareTransitions).forEach((edge) => {
    const target = resolveTargetNode(graph, edge.target);
    if (!target) return;
    const signal = transitionSignal(edge);
    const transitions = bySignal.get(signal) ?? [];
    const childScope = target.childScopeId ? graph.scopes.find((scope) => scope.id === target.childScopeId) : undefined;
    const targetRef = childScope && childScope.history !== "none" ? `#${childScope.id}:history` : `#${target.id}`;
    transitions.push({ target: targetRef });
    bySignal.set(signal, transitions);
  });
  if (!bySignal.size) return undefined;
  return Object.fromEntries([...bySignal].map(([signal, transitions]) => [signal, transitions.length === 1 ? transitions[0] : transitions]));
}

function mergeTransitionMaps(
  left?: Record<string, TransitionConfig | TransitionConfig[]>,
  right?: Record<string, TransitionConfig | TransitionConfig[]>,
): Record<string, TransitionConfig | TransitionConfig[]> | undefined {
  if (!left) return right;
  if (!right) return left;
  return { ...left, ...right };
}

function resolveTargetNode(graph: GraphDefinition, targetId: string): GraphNode | undefined {
  const target = graph.nodes.find((node) => node.id === targetId);
  if (!target) return undefined;
  if (target.kind === "entry" && target.scopeId) {
    const scope = graph.scopes.find((item) => item.id === target.scopeId);
    return graph.nodes.find((node) => node.id === scope?.initialNodeId);
  }
  if (target.kind === "exit") return undefined;
  return target;
}

function resolveExitTransition(
  graph: GraphDefinition,
  edge: GraphEdge,
  blackboard: BlackboardEntry[],
  eventName?: string,
): GraphEdge | undefined {
  const target = graph.nodes.find((node) => node.id === edge.target);
  if (target?.kind !== "exit" || !target.scopeId) return edge;
  const scope = graph.scopes.find((item) => item.id === target.scopeId);
  if (!scope?.ownerNodeId) return undefined;
  return graph.edges
    .filter((candidate) => candidate.source === scope.ownerNodeId)
    .filter((candidate) => getTransitionTriggerType(candidate) === "completed" || isTransitionEligible(candidate, blackboard, { eventName, elapsedMs: 0, completed: true }))
    .sort(compareTransitions)[0];
}

function getActivePath(graph: GraphDefinition, leafNodeId: string): string[] {
  const leaf = graph.nodes.find((node) => node.id === leafNodeId);
  if (!leaf) return [];
  const path = [leaf.id];
  let scope = graph.scopes.find((item) => item.id === leaf.scopeId);
  const visited = new Set<string>();
  while (scope?.ownerNodeId && !visited.has(scope.id)) {
    visited.add(scope.id);
    path.unshift(scope.ownerNodeId);
    scope = graph.scopes.find((item) => item.id === scope?.parentScopeId);
  }
  return path;
}

function transitionSignal(edge: GraphEdge): string { return `transition:${edge.id}`; }
function compareTransitions(left: GraphEdge, right: GraphEdge): number {
  return (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id);
}
function flattenStateValue(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...flattenStateValue(child)]);
}
function createNodeStates(graph: GraphDefinition, activeNodeId?: string): Record<string, RuntimeNodeState> {
  const active = new Set(activeNodeId ? getActivePath(graph, activeNodeId) : []);
  return Object.fromEntries(graph.nodes.map((node) => [node.id, active.has(node.id) ? "active" : "ready"]));
}
function nodeName(graph: GraphDefinition, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}
function cloneSnapshot(snapshot: PatternRuntimeSnapshot): PatternRuntimeSnapshot {
  return { ...snapshot, activePath: snapshot.activePath ? [...snapshot.activePath] : [], nodeStates: { ...snapshot.nodeStates }, coverage: { ...snapshot.coverage }, stateDurationsMs: { ...snapshot.stateDurationsMs }, failedConditions: [...snapshot.failedConditions], replay: [...snapshot.replay], trace: [...snapshot.trace] };
}
