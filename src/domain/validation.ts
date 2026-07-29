import type { FsmGraph, ProjectDocument } from "./project";

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  entityId?: string;
}

export function validateFsm(document: ProjectDocument, graph: FsmGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stateIds = new Set(graph.states.map((state) => state.id));
  const actionIds = new Set(document.actions.map((action) => action.id));

  if (!graph.initialStateId) {
    issues.push({
      id: `${graph.id}:initial`,
      severity: "error",
      message: "시작 상태가 지정되지 않았습니다.",
      entityId: graph.id,
    });
  } else if (!stateIds.has(graph.initialStateId)) {
    issues.push({
      id: `${graph.id}:missing-initial`,
      severity: "error",
      message: "시작 상태 참조가 끊어졌습니다.",
      entityId: graph.initialStateId,
    });
  }

  graph.transitions.forEach((transition) => {
    if (!stateIds.has(transition.sourceStateId) || !stateIds.has(transition.targetStateId)) {
      issues.push({
        id: `${transition.id}:broken`,
        severity: "error",
        message: "존재하지 않는 상태로 연결된 전환입니다.",
        entityId: transition.id,
      });
    }
  });

  graph.states.forEach((state) => {
    const references = [
      ...state.entryActionIds,
      ...state.updateActionIds,
      ...state.exitActionIds,
    ];
    references.forEach((actionId) => {
      if (!actionIds.has(actionId)) {
        issues.push({
          id: `${state.id}:${actionId}`,
          severity: "error",
          message: `"${state.name}" 상태가 존재하지 않는 행동을 참조합니다.`,
          entityId: state.id,
        });
      }
    });
  });

  return issues;
}
