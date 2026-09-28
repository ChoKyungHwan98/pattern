import type { GraphDefinition, GraphNode, Point, StateMachineScope } from "./model";

export function getRootScope(graph: GraphDefinition): StateMachineScope | undefined {
  if (graph.mode === "bt") return undefined;
  return graph.scopes.find((scope) => scope.id === graph.rootScopeId)
    ?? graph.scopes.find((scope) => !scope.parentScopeId)
    ?? graph.scopes[0];
}

export function getScope(graph: GraphDefinition, scopeId?: string): StateMachineScope | undefined {
  return graph.scopes.find((scope) => scope.id === scopeId) ?? getRootScope(graph);
}

export function nodesInScope(graph: GraphDefinition, scopeId?: string): GraphNode[] {
  if (graph.mode === "bt") return graph.nodes;
  const resolved = getScope(graph, scopeId)?.id;
  return graph.nodes.filter((node) => node.scopeId === resolved);
}

export function scopePath(graph: GraphDefinition, scopeId?: string): StateMachineScope[] {
  const path: StateMachineScope[] = [];
  let current = getScope(graph, scopeId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentScopeId
      ? graph.scopes.find((scope) => scope.id === current?.parentScopeId)
      : undefined;
  }
  return path;
}

export function createChildMachine(
  graph: GraphDefinition,
  parentScopeId: string,
  name = "새 행동 묶음",
  position: Point = { x: 420, y: 240 },
): { graph: GraphDefinition; ownerNodeId: string; scopeId: string } {
  const scopeId = `scope-${crypto.randomUUID()}`;
  const ownerNodeId = `submachine-${crypto.randomUUID()}`;
  const scope: StateMachineScope = {
    id: scopeId,
    name,
    parentScopeId,
    ownerNodeId,
    history: "none",
    regionMode: "exclusive",
  };
  const owner: GraphNode = {
    id: ownerNodeId,
    name,
    kind: "submachine",
    scopeId: parentScopeId,
    childScopeId: scopeId,
    position,
    subtitle: "행동 묶음",
  };
  const graphWithScope = {
    ...graph,
    scopes: [...graph.scopes, scope],
    nodes: [...graph.nodes, owner],
  };
  return {
    graph: ensureScopeSystemNodes(graphWithScope, scopeId),
    ownerNodeId,
    scopeId,
  };
}

export function ensureScopeSystemNodes(graph: GraphDefinition, scopeId: string): GraphDefinition {
  if (graph.mode === "bt") return graph;
  const scope = graph.scopes.find((item) => item.id === scopeId);
  if (!scope) return graph;
  const existing = graph.nodes.filter((node) => node.scopeId === scopeId);
  const additions: GraphNode[] = [];
  if (!existing.some((node) => node.kind === "entry")) {
    additions.push(systemNode(scopeId, "entry", "Entry", { x: 80, y: 170 }));
  }
  if (!existing.some((node) => node.kind === "any")) {
    additions.push(systemNode(scopeId, "any", "Any State", { x: 80, y: 300 }));
  }
  if (!existing.some((node) => node.kind === "exit")) {
    additions.push(systemNode(scopeId, "exit", "Exit", { x: 760, y: 300 }));
  }
  if (!additions.length) return graph;
  return { ...graph, nodes: [...graph.nodes, ...additions] };
}

export function ensureAllScopeSystemNodes(graph: GraphDefinition): GraphDefinition {
  return graph.scopes.reduce((current, scope) => ensureScopeSystemNodes(current, scope.id), graph);
}

export function isSystemNode(node?: GraphNode): boolean {
  return node?.kind === "entry" || node?.kind === "any" || node?.kind === "exit";
}

function systemNode(
  scopeId: string,
  kind: "entry" | "any" | "exit",
  name: string,
  position: Point,
): GraphNode {
  return {
    id: `${scopeId}:${kind}`,
    name,
    kind,
    scopeId,
    position,
    subtitle: kind === "entry" ? "진입" : kind === "exit" ? "상위로 복귀" : "전역 전이",
  };
}
