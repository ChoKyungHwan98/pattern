import type { PatternLibrary, PatternSet } from "./model";

const CHANNEL = "gds:tool";

export function patternArtifactRecord(set: PatternSet) {
  return {
    artifactId: set.id,
    kind: "pattern-set",
    title: set.name,
    revision: set.updatedAt,
    fingerprint: `${set.updatedAt}:${set.graphs.length}:${set.graphs.reduce((sum, graph) => sum + graph.nodes.length + graph.edges.length, 0)}`,
    summary: set.description || `${set.graphs.length}개의 행동 패턴`,
    data: {
      description: set.description,
      blackboard: set.blackboard.map((entry) => ({ key: entry.key, type: entry.type, defaultValue: entry.defaultValue })),
      graphs: set.graphs.map((graph) => ({
        id: graph.id, name: graph.name, mode: graph.mode,
        nodes: graph.nodes.map((node) => ({ id: node.id, name: node.name, kind: node.kind, position: node.position, subtitle: node.subtitle })),
        edges: graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, conditions: edge.conditions })),
        scopes: graph.scopes.map((scope) => ({ id: scope.id, name: scope.name, parentScopeId: scope.parentScopeId }))
      }))
    }
  };
}

export function publishPatternArtifacts(library: PatternLibrary): void {
  if (new URLSearchParams(window.location.search).get("host") !== "studio" || window.parent === window) return;
  library.sets.forEach((set) => {
    window.parent.postMessage({
      channel: CHANNEL, type: "artifact:publish", requestId: `pattern-publish-${crypto.randomUUID()}`,
      record: patternArtifactRecord(set)
    }, window.location.origin);
  });
}
