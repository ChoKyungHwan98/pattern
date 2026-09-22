import type { GraphDefinition, GraphNode } from "./model";
import { isSystemNode } from "./stateMachine";

export interface GraphCommandResult {
  graph: GraphDefinition;
  selectedNodeId?: string;
}

export function deleteGraphNode(graph: GraphDefinition, nodeId: string): GraphCommandResult {
  const target = graph.nodes.find((node) => node.id === nodeId);
  if (!target) return { graph, selectedNodeId: undefined };
  if (isSystemNode(target)) return { graph, selectedNodeId: target.id };

  const removedScopeIds = target.childScopeId
    ? collectScopeTree(graph, target.childScopeId)
    : new Set<string>();
  const removedNodeIds = new Set([
    nodeId,
    ...graph.nodes.filter((node) => node.scopeId && removedScopeIds.has(node.scopeId)).map((node) => node.id),
  ]);
  const remainingNodes = graph.nodes.filter((node) => !removedNodeIds.has(node.id));
  const fallbackNode =
    remainingNodes.find((node) => node.scopeId === target.scopeId && !isSystemNode(node))
    ?? remainingNodes[0];
  const fallbackId = fallbackNode?.id;

  return {
    graph: {
      ...graph,
      nodes: remainingNodes,
      edges: graph.edges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)),
      scopes: graph.scopes
        .filter((scope) => !removedScopeIds.has(scope.id))
        .map((scope) => scope.initialNodeId && removedNodeIds.has(scope.initialNodeId)
          ? { ...scope, initialNodeId: remainingNodes.find((node) => node.scopeId === scope.id && !isSystemNode(node))?.id }
          : scope),
      initialNodeId: graph.initialNodeId === nodeId ? fallbackId : graph.initialNodeId,
      rootNodeId: graph.rootNodeId === nodeId ? fallbackId : graph.rootNodeId,
    },
    selectedNodeId: fallbackId,
  };
}

export function deleteGraphEdge(graph: GraphDefinition, edgeId: string): GraphDefinition {
  if (!graph.edges.some((edge) => edge.id === edgeId)) return graph;
  return { ...graph, edges: graph.edges.filter((edge) => edge.id !== edgeId) };
}

export function duplicateGraphNode(
  graph: GraphDefinition,
  source: GraphNode,
  offset = 32,
): GraphCommandResult {
  const parentExists = source.parentId
    ? graph.scopes.some((scope) => scope.id === source.parentId)
    : true;
  const scopeExists = source.scopeId ? graph.scopes.some((scope) => scope.id === source.scopeId) : true;
  const node: GraphNode = {
    ...source,
    id: `${graph.mode}-node-${crypto.randomUUID()}`,
    name: copyName(source.name),
    position: { x: source.position.x + offset, y: source.position.y + offset },
    parentId: parentExists ? source.parentId : undefined,
    scopeId: scopeExists ? source.scopeId : graph.rootScopeId,
    childScopeId: undefined,
    decorators: source.decorators ? [...source.decorators] : undefined,
  };

  return {
    graph: { ...graph, nodes: [...graph.nodes, node] },
    selectedNodeId: node.id,
  };
}

function collectScopeTree(graph: GraphDefinition, rootScopeId: string): Set<string> {
  const result = new Set<string>();
  const visit = (scopeId: string) => {
    if (result.has(scopeId)) return;
    result.add(scopeId);
    graph.scopes.filter((scope) => scope.parentScopeId === scopeId).forEach((scope) => visit(scope.id));
  };
  visit(rootScopeId);
  return result;
}

function copyName(name: string): string {
  const match = name.match(/^(.*) 복사본(?: (\d+))?$/);
  if (!match) return `${name} 복사본`;
  return `${match[1]} 복사본 ${Number(match[2] ?? 1) + 1}`;
}
