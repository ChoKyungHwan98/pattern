import type { BlackboardEntry, GraphDefinition } from "./model";
import { getTransitionTriggerType } from "./transitionSemantics";

export interface GraphIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  entityId?: string;
}

export function validateGraph(graph: GraphDefinition, blackboard: BlackboardEntry[] = []): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const nodeIds = new Set<string>();
  const scopeIds = new Set<string>();

  graph.scopes.forEach((scope) => {
    if (scopeIds.has(scope.id) || nodeIds.has(scope.id)) {
      issues.push(duplicateIdIssue(scope.id));
    }
    scopeIds.add(scope.id);
  });

  graph.nodes.forEach((node) => {
    if (nodeIds.has(node.id) || scopeIds.has(node.id)) {
      issues.push(duplicateIdIssue(node.id));
    }
    nodeIds.add(node.id);
    if (graph.mode !== "bt" && (!node.scopeId || !scopeIds.has(node.scopeId))) {
      issues.push({
        id: `missing-parent:${node.id}`,
        severity: "error",
        message: `“${node.name}” 노드의 상태 머신 스코프가 없습니다.`,
        entityId: node.id,
      });
    }
  });

  graph.edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        id: `broken-edge:${edge.id}`,
        severity: "error",
        message: `“${edge.id}” 전환이 존재하지 않는 노드를 참조합니다.`,
        entityId: edge.id,
      });
    }
    if (edge.source === edge.target) {
      issues.push({
        id: `self-edge:${edge.id}`,
        severity: "warning",
        message: `“${edge.id}” 전환이 같은 노드로 돌아갑니다.`,
        entityId: edge.id,
      });
    }
    if (graph.mode !== "bt") {
      const triggerType = getTransitionTriggerType(edge);
      if (triggerType === "event" && !(edge.eventName?.trim() || edge.trigger?.trim() || edge.label?.trim())) {
        issues.push({
          id: `missing-event:${edge.id}`,
          severity: "error",
          message: "이벤트 전환에 이벤트 이름이 없습니다.",
          entityId: edge.id,
        });
      }
      if (triggerType === "condition" && !(edge.conditions?.length || edge.guard?.trim())) {
        issues.push({
          id: `missing-condition:${edge.id}`,
          severity: "error",
          message: "조건 전환에 조건이 없습니다.",
          entityId: edge.id,
        });
      }
      if (blackboard.length > 0) {
        const keys = new Set(blackboard.map((entry) => entry.key));
        edge.conditions?.forEach((condition) => {
          if (!keys.has(condition.key)) {
            issues.push({
              id: `missing-blackboard-key:${edge.id}:${condition.id}`,
              severity: "error",
              message: `전환 조건이 존재하지 않는 블랙보드 키 “${condition.key || "(비어 있음)"}”를 참조합니다.`,
              entityId: edge.id,
            });
          }
        });
      }
    }
  });

  if (graph.mode === "bt") {
    validateBehaviorTree(graph, nodeIds, issues);
  } else {
    validateStateMachine(graph, nodeIds, scopeIds, issues);
  }

  return issues;
}

function validateStateMachine(
  graph: GraphDefinition,
  nodeIds: Set<string>,
  scopeIds: Set<string>,
  issues: GraphIssue[],
) {
  if (!graph.initialNodeId || !nodeIds.has(graph.initialNodeId)) {
    issues.push({
      id: "missing-initial-state",
      severity: "error",
      message: "유효한 시작 상태가 지정되지 않았습니다.",
      entityId: graph.initialNodeId,
    });
  }

  if (!graph.rootScopeId || !scopeIds.has(graph.rootScopeId)) {
    issues.push({ id: "missing-root-scope", severity: "error", message: "루트 상태 머신 스코프가 없습니다.", entityId: graph.rootScopeId });
  }

  graph.scopes.forEach((scope) => {
    if (scope.parentScopeId && !scopeIds.has(scope.parentScopeId)) {
      issues.push({
        id: `missing-scope-parent:${scope.id}`,
        severity: "error",
        message: `“${scope.name}” 상태 머신의 상위 스코프가 없습니다.`,
        entityId: scope.id,
      });
    }
    if (scope.ownerNodeId && !graph.nodes.some((node) => node.id === scope.ownerNodeId && node.childScopeId === scope.id)) {
      issues.push({
        id: `missing-scope-owner:${scope.id}`,
        severity: "error",
        message: `“${scope.name}” 상태 머신의 상위 노드가 없습니다.`,
        entityId: scope.id,
      });
    }
    const children = graph.nodes.filter((node) => node.scopeId === scope.id && ["state", "submachine"].includes(node.kind));
    if (
      children.length > 0 && (!scope.initialNodeId || !children.some((node) => node.id === scope.initialNodeId))
    ) {
      issues.push({
        id: `missing-scope-initial:${scope.id}`,
        severity: "error",
        message: `“${scope.name}” 상태 머신의 기본 상태가 지정되지 않았습니다.`,
        entityId: scope.id,
      });
    }
    (["entry", "any", "exit"] as const).forEach((kind) => {
      if (!graph.nodes.some((node) => node.scopeId === scope.id && node.kind === kind)) {
        issues.push({ id: `missing-${kind}:${scope.id}`, severity: "error", message: `“${scope.name}”에 ${kind} 노드가 없습니다.`, entityId: scope.id });
      }
    });
  });

  graph.nodes.forEach((node) => {
    if (node.kind === "submachine" && (!node.childScopeId || !graph.scopes.some((scope) => scope.id === node.childScopeId && scope.ownerNodeId === node.id))) {
      issues.push({ id: `broken-submachine:${node.id}`, severity: "error", message: `“${node.name}”의 하위 상태 머신 연결이 끊어졌습니다.`, entityId: node.id });
    }
    const incoming = graph.edges.filter((edge) => edge.target === node.id);
    const outgoing = graph.edges.filter((edge) => edge.source === node.id);
    if ((node.kind === "entry" || node.kind === "any") && incoming.length > 0) {
      issues.push({ id: `invalid-incoming:${node.id}`, severity: "error", message: `${node.name} 노드에는 들어오는 전환을 연결할 수 없습니다.`, entityId: node.id });
    }
    if (node.kind === "exit" && outgoing.length > 0) {
      issues.push({ id: `invalid-exit-outgoing:${node.id}`, severity: "error", message: "Exit 노드에서는 전환이 나갈 수 없습니다.", entityId: node.id });
    }
  });

  graph.edges.forEach((edge) => {
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!source || !target || source.scopeId === target.scopeId) return;
    const legalBoundary = source.kind === "submachine" || source.kind === "any" || target.kind === "entry" || target.kind === "exit";
    if (!legalBoundary) {
      issues.push({ id: `illegal-cross-scope:${edge.id}`, severity: "error", message: "스코프를 건너뛰는 전환입니다. 하위 머신의 Entry/Exit를 사용하세요.", entityId: edge.id });
    }
  });

  graph.scopes.forEach((scope) => {
    const visited = new Set<string>();
    let cursor: typeof scope | undefined = scope;
    while (cursor?.parentScopeId) {
      if (visited.has(cursor.id)) {
        issues.push({ id: `scope-cycle:${scope.id}`, severity: "error", message: `“${scope.name}”의 계층이 순환합니다.`, entityId: scope.id });
        break;
      }
      visited.add(cursor.id);
      cursor = graph.scopes.find((item) => item.id === cursor?.parentScopeId);
    }
  });

  const alwaysBySource = new Map<string, number>();
  graph.edges.forEach((edge) => {
    if (getTransitionTriggerType(edge) !== "always") return;
    alwaysBySource.set(edge.source, (alwaysBySource.get(edge.source) ?? 0) + 1);
  });
  alwaysBySource.forEach((count, source) => {
    if (count < 2) return;
    issues.push({
      id: `ambiguous-always:${source}`,
      severity: "error",
      message: `한 상태에서 무조건 전환이 ${count}개 나갑니다. 조건이나 이벤트를 지정하세요.`,
      entityId: source,
    });
  });
}

function validateBehaviorTree(
  graph: GraphDefinition,
  nodeIds: Set<string>,
  issues: GraphIssue[],
) {
  if (!graph.rootNodeId || !nodeIds.has(graph.rootNodeId)) {
    issues.push({
      id: "missing-bt-root",
      severity: "error",
      message: "Behavior Tree 루트가 지정되지 않았습니다.",
      entityId: graph.rootNodeId,
    });
  }

  const outgoing = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  });
  graph.nodes.forEach((node) => {
    if (
      (node.kind === "selector" || node.kind === "sequence") &&
      (outgoing.get(node.id)?.length ?? 0) === 0
    ) {
      issues.push({
        id: `empty-composite:${node.id}`,
        severity: "warning",
        message: `“${node.name}” 복합 노드에 자식이 없습니다.`,
        entityId: node.id,
      });
    }
  });

  if (graph.rootNodeId && hasCycle(graph.rootNodeId, outgoing)) {
    issues.push({
      id: "bt-cycle",
      severity: "error",
      message: "Behavior Tree에 순환 연결이 있습니다.",
      entityId: graph.rootNodeId,
    });
  }
}

function hasCycle(rootId: string, outgoing: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };
  return visit(rootId);
}

function duplicateIdIssue(id: string): GraphIssue {
  return {
    id: `duplicate:${id}`,
    severity: "error",
    message: `중복 ID “${id}”가 있습니다.`,
    entityId: id,
  };
}
