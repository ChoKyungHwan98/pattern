/**
 * Pattern Designer PR3–PR4 — Behavior Canvas presentation.
 *
 * Front-facing language is Situation(상황) / Action(행동) / Decision(판단).
 * Condition / ContextVariable are authored on edges & Inspector (not free graph nodes).
 * Entry / Any State / Exit remain in data for the adapter but stay hidden from default UX.
 * PR8: empty Behavior → 「첫 상황 만들기」; interrupt copy = 「어떤 상황에서도」.
 *
 * PR4: Decision canvas shows candidates + brief criteria only — never live
 * utility scores in edit mode. Flow edge conditions stay separate.
 * PR5: live scores appear only when Simulation / Decision Trace is active.
 */

import type { DomainEntityKind, DecisionCandidate } from "./domain";
import {
  formatCandidateCriteriaBrief,
  normalizeDecisionCandidates,
  resolveDomainEntityKind,
} from "./domain";
import type { GraphDefinition, GraphEdge, GraphMode, GraphNode, Point } from "./model";
import { isSystemNode } from "./stateMachine";

export type BehaviorPaletteId = "situation" | "action" | "decision" | "condition" | "variable";

export interface BehaviorPaletteItem {
  id: BehaviorPaletteId;
  label: string;
  shortDescription: string;
  /** Domain / graph mapping used when the item creates a node. */
  entityKind?: DomainEntityKind | "condition";
}

/**
 * Default 「+ 요소 추가」 choices — Situation / Action / Decision only.
 * Condition & ContextVariable are authored on edges / Inspector (PR8).
 */
export const BEHAVIOR_PALETTE: BehaviorPaletteItem[] = [
  {
    id: "situation",
    label: "상황",
    shortDescription: "캐릭터가 지금 어떤 상태인지",
    entityKind: "state",
  },
  {
    id: "action",
    label: "행동",
    shortDescription: "캐릭터가 실제로 무엇을 하는지",
    entityKind: "action",
  },
  {
    id: "decision",
    label: "판단",
    shortDescription: "여러 행동 중 무엇을 할지 고르는 지점",
    entityKind: "decision",
  },
];

/** Advanced / legacy palette entries — not shown in default +요소 추가. */
export const BEHAVIOR_PALETTE_ADVANCED: BehaviorPaletteItem[] = [
  {
    id: "condition",
    label: "조건",
    shortDescription: "흐름 선에서 작성하세요. 예: 가까움, 공격받음",
    entityKind: "condition",
  },
  {
    id: "variable",
    label: "문맥 값",
    shortDescription: "조건 작성 중 「새 문맥 값 만들기」로 추가",
  },
];

export function behaviorEntityLabel(kind: DomainEntityKind | "condition" | "variable" | "submachine"): string {
  switch (kind) {
    case "state":
      return "상황";
    case "action":
      return "행동";
    case "decision":
      return "판단";
    case "condition":
      return "조건";
    case "variable":
      return "문맥 값";
    case "submachine":
      return "행동 묶음";
  }
}

/** Document chrome label — one Behavior Canvas, not FSM vs BT product choice. */
export function behaviorDocumentLabel(_mode?: GraphMode): string {
  void _mode;
  return "행동 캔버스";
}

export function isCanvasVisibleNode(node: GraphNode): boolean {
  return !isSystemNode(node);
}

export function visibleBehaviorNodes(graph: GraphDefinition, scopeId?: string): GraphNode[] {
  const visibleScopeId = graph.mode === "bt" ? undefined : scopeId ?? graph.rootScopeId;
  return graph.nodes.filter((node) => {
    if (!isCanvasVisibleNode(node)) return false;
    if (graph.mode === "bt") return true;
    return node.scopeId === visibleScopeId;
  });
}

export function firstSelectableNodeId(graph: GraphDefinition, scopeId?: string): string | undefined {
  const visible = visibleBehaviorNodes(graph, scopeId);
  const preferred = visible.find((node) => node.id === graph.initialNodeId)
    ?? visible.find((node) => {
      const scope = graph.scopes.find((item) => item.id === (scopeId ?? graph.rootScopeId));
      return scope?.initialNodeId === node.id;
    })
    ?? visible[0];
  return preferred?.id ?? graph.initialNodeId ?? graph.rootNodeId;
}

export function situationNodesInScope(graph: GraphDefinition, scopeId?: string): GraphNode[] {
  return visibleBehaviorNodes(graph, scopeId).filter((node) => {
    if (node.kind === "submachine") return true;
    const entity = resolveDomainEntityKind(node);
    return entity === "state" || entity === "action" || entity === "decision" || node.kind === "state";
  });
}

export function interruptEdges(graph: GraphDefinition, scopeId?: string): GraphEdge[] {
  const scope = scopeId ?? graph.rootScopeId;
  const anyNode = graph.nodes.find((node) => node.scopeId === scope && node.kind === "any");
  if (!anyNode) return [];
  return graph.edges.filter((edge) => edge.source === anyNode.id);
}

export function exitReturnEdges(graph: GraphDefinition, scopeId?: string): GraphEdge[] {
  const scope = scopeId ?? graph.rootScopeId;
  const exitNode = graph.nodes.find((node) => node.scopeId === scope && node.kind === "exit");
  if (!exitNode) return [];
  return graph.edges.filter((edge) => edge.target === exitNode.id);
}

export function findScopeSystemNode(
  graph: GraphDefinition,
  kind: "entry" | "any" | "exit",
  scopeId?: string,
): GraphNode | undefined {
  const scope = scopeId ?? graph.rootScopeId;
  return graph.nodes.find((node) => node.scopeId === scope && node.kind === kind);
}

export interface DecisionCanvasBrief {
  headline: string;
  lines: string[];
  /** Present only when Simulation / Decision Trace is active. */
  scoreActive?: boolean;
}

/**
 * Edit-mode Decision canvas summary: candidates + brief criteria.
 * Never shows live final scores (selection/scoring is sim-only later).
 */
export function decisionCanvasBrief(
  node: GraphNode,
  resolveName: (nodeId: string) => string = (id) => id,
): DecisionCanvasBrief | undefined {
  const entity = resolveDomainEntityKind(node);
  if (entity !== "decision" && node.kind !== "selector") return undefined;
  const candidates = normalizeDecisionCandidates(node.domain);
  const kindLabel = "판단";
  if (candidates.length === 0) {
    return { headline: `${kindLabel} · 후보 없음`, lines: [] };
  }
  const lines = candidates.map((candidate) => {
    const name = candidate.actionNodeId
      ? resolveName(candidate.actionNodeId) || candidate.actionNodeId
      : "(행동 미지정)";
    const criteria = formatCandidateCriteriaBrief(candidate, 1);
    return `${name} — ${criteria}`;
  });
  return {
    headline: `${kindLabel} · 후보 ${candidates.length}`,
    lines,
  };
}

/** @deprecated use decisionCanvasBrief — kept so older call sites compile during PR4. */
export function decisionScoreStubLabel(node: GraphNode): string | undefined {
  const brief = decisionCanvasBrief(node);
  return brief?.headline;
}

export function decisionCandidates(node: GraphNode): DecisionCandidate[] {
  const entity = resolveDomainEntityKind(node);
  if (entity !== "decision" && node.kind !== "selector") return [];
  return normalizeDecisionCandidates(node.domain);
}

export function canvasNodeBadge(node: GraphNode): string {
  if (node.kind === "submachine") return "묶";
  const entity = resolveDomainEntityKind(node);
  if (entity === "state") return "상";
  if (entity === "action") return "행";
  if (entity === "decision") return "판";
  if (node.kind === "condition") return "조";
  if (node.kind === "task") return "행";
  if (node.kind === "selector") return "판";
  if (node.kind === "sequence") return "순";
  return "·";
}

export function canvasNodeKindName(node: GraphNode): string {
  if (node.kind === "submachine") return behaviorEntityLabel("submachine");
  const entity = resolveDomainEntityKind(node);
  if (entity === "state") return behaviorEntityLabel("state");
  if (entity === "action") return behaviorEntityLabel("action");
  if (entity === "decision") {
    return "판단";
  }
  if (node.kind === "condition") return behaviorEntityLabel("condition");
  if (node.kind === "task") return behaviorEntityLabel("action");
  if (node.kind === "selector") return behaviorEntityLabel("decision");
  if (node.kind === "sequence") return "순서";
  // Hidden system kinds — kept for completeness if ever rendered.
  if (node.kind === "entry") return "시작";
  if (node.kind === "exit") return "종료/복귀";
  if (node.kind === "any") return "어떤 상황에서도";
  return node.kind;
}

export function createConditionGraphNode(options: {
  mode: GraphMode;
  index: number;
  scopeId?: string;
  position: Point;
  id?: string;
}): GraphNode {
  return {
    id: options.id ?? `condition-${crypto.randomUUID()}`,
    name: `새 조건 ${options.index}`,
    kind: "condition",
    scopeId: options.mode === "bt" ? undefined : options.scopeId,
    position: options.position,
    subtitle: behaviorEntityLabel("condition"),
  };
}


/** Decision → Candidate Action link (utility candidate, not Situation flow IF/ELSE). */
export function isDecisionCandidateEdge(graph: GraphDefinition, edge: GraphEdge): boolean {
  const source = graph.nodes.find((node) => node.id === edge.source);
  if (!source) return false;
  const entity = resolveDomainEntityKind(source);
  if (entity !== "decision" && source.kind !== "selector") return false;
  const candidates = normalizeDecisionCandidates(source.domain);
  if (candidates.some((item) => item.actionNodeId === edge.target)) return true;
  // Fallback: any outbound edge from a Decision toward a non-system node is a candidate link.
  const target = graph.nodes.find((node) => node.id === edge.target);
  if (!target || isSystemNode(target)) return false;
  return true;
}

/** Situation→Situation (or Situation→Decision) flow edges keep readable condition labels. */
export function isSituationFlowEdge(graph: GraphDefinition, edge: GraphEdge): boolean {
  const source = graph.nodes.find((node) => node.id === edge.source);
  if (!source) return false;
  const entity = resolveDomainEntityKind(source);
  return entity === "state" || (!entity && source.kind === "state");
}
