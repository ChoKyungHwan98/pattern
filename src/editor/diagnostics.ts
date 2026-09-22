import type { PatternSet } from "./model";
import { validateGraph } from "./graphValidation";

export function createDiagnosticsReport(set: PatternSet) {
  const actionIds = new Set(set.actions.map((action) => action.id));
  const missingBindings = set.graphs.flatMap((graph) => graph.nodes.flatMap((node) =>
    (node.actions ?? []).filter((binding) => !actionIds.has(binding.actionId)).map((binding) => ({ graphId: graph.id, nodeId: node.id, actionId: binding.actionId })),
  ));
  const graphs = set.graphs.map((graph) => {
    const issues = validateGraph(graph, set.blackboard);
    return {
      id: graph.id,
      name: graph.name,
      kind: graph.mode,
      nodes: graph.nodes.length,
      transitions: graph.edges.length,
      hierarchyDepth: graph.mode === "state-machine" ? maxDepth(graph.scopes) : 0,
      errors: issues.filter((issue) => issue.severity === "error"),
      warnings: issues.filter((issue) => issue.severity === "warning"),
    };
  });
  return {
    schema: "game-design-studio.pattern-diagnostics",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    set: { id: set.id, name: set.name, updatedAt: set.updatedAt },
    summary: {
      graphs: graphs.length,
      stateMachines: graphs.filter((graph) => graph.kind === "state-machine").length,
      behaviorTrees: graphs.filter((graph) => graph.kind === "bt").length,
      blackboardEntries: set.blackboard.length,
      actionDefinitions: set.actions.length,
      conditionDefinitions: set.conditions.length,
      errors: graphs.reduce((sum, graph) => sum + graph.errors.length, 0) + missingBindings.length,
      warnings: graphs.reduce((sum, graph) => sum + graph.warnings.length, 0),
    },
    graphs,
    missingBindings,
    engineReadiness: {
      unity: missingBindings.length === 0 && set.actions.every((action) => Boolean(action.unityType)),
      unreal: missingBindings.length === 0 && set.actions.every((action) => Boolean(action.unrealType)),
    },
  };
}

function maxDepth(scopes: PatternSet["graphs"][number]["scopes"]): number {
  const depth = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    const scope = scopes.find((item) => item.id === id);
    if (!scope?.parentScopeId) return 1;
    return 1 + depth(scope.parentScopeId, new Set([...seen, id]));
  };
  return Math.max(0, ...scopes.map((scope) => depth(scope.id)));
}
