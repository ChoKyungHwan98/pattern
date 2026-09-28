import type {
  BlackboardEntry,
  ConditionOperator,
  GraphEdge,
  TransitionCondition,
  TransitionTriggerType,
} from "./model";

export interface TransitionEvaluationContext {
  eventName?: string;
  elapsedMs?: number;
  completed?: boolean;
}

export function getTransitionTriggerType(edge: GraphEdge): TransitionTriggerType {
  if (edge.triggerType) return edge.triggerType;
  if ((edge.conditions?.length ?? 0) > 0 || edge.guard?.trim()) return "condition";
  if (edge.trigger?.trim()) return "event";
  if (edge.label?.trim() && edge.label.trim() !== "조건 없음") return "event";
  return "always";
}

export function summarizeTransition(edge: GraphEdge): string {
  const type = getTransitionTriggerType(edge);
  if (type === "condition") {
    if (!edge.conditions?.length) return edge.guard?.trim() || "조건을 추가하세요";
    const separator = edge.conditionMode === "any" ? " 또는 " : " 그리고 ";
    return edge.conditions.map(summarizeCondition).join(separator);
  }
  if (type === "event") return edge.eventName?.trim() || edge.trigger?.trim() || edge.label?.trim() || "이벤트를 지정하세요";
  if (type === "completed") return "행동 완료 시";
  if (type === "timeout") return `${Math.max(0, edge.timeoutMs ?? 0)}ms 후`;
  return "항상";
}

export function isTransitionEligible(
  edge: GraphEdge,
  blackboard: BlackboardEntry[],
  context: TransitionEvaluationContext = {},
): boolean {
  const type = getTransitionTriggerType(edge);
  if ((context.elapsedMs ?? 0) < Math.max(0, edge.minimumStateTimeMs ?? 0)) return false;
  if (edge.interruptPolicy === "after-action" && type !== "completed" && (context.elapsedMs ?? 0) < 100) return false;
  if (type === "always") return true;
  if (type === "completed") return context.completed ?? (context.elapsedMs ?? 0) >= 100;
  if (type === "event") {
    const expected = edge.eventName?.trim() || edge.trigger?.trim() || edge.label?.trim();
    if (!edge.triggerType && !context.eventName) return Boolean(expected);
    return Boolean(expected && context.eventName === expected);
  }
  if (type === "timeout") {
    return (context.elapsedMs ?? 0) >= Math.max(0, edge.timeoutMs ?? 0);
  }
  if (!edge.conditions?.length) return false;
  const values = new Map(blackboard.map((entry) => [entry.key, entry]));
  const results = edge.conditions.map((condition) => evaluateCondition(condition, values.get(condition.key)));
  return edge.conditionMode === "any" ? results.some(Boolean) : results.every(Boolean);
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  "==": "같음",
  "!=": "다름",
  ">": "큼",
  ">=": "크거나 같음",
  "<": "작음",
  "<=": "작거나 같음",
  contains: "포함",
};

export function operatorLabel(operator: ConditionOperator): string {
  return OPERATOR_LABELS[operator] ?? operator;
}

/** Readable Korean sentence for canvas / inspector — not raw expression. */
export function summarizeCondition(condition: TransitionCondition): string {
  const variable = condition.key?.trim() || "변수";
  const op = operatorLabel(condition.operator);
  const value = condition.value?.trim() || "값";
  return `${variable} ${op} ${value}`;
}

function evaluateCondition(condition: TransitionCondition, entry?: BlackboardEntry): boolean {
  if (!entry) return false;
  const left = parseValue(entry.liveValue, entry.type);
  const right = parseValue(condition.value, entry.type);
  return compareValues(left, right, condition.operator);
}

function parseValue(value: string, type: BlackboardEntry["type"]): string | number | boolean {
  if (type === "Float" || type === "Int") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  if (type === "Bool") return value.trim().toLowerCase() === "true";
  return value.trim();
}

function compareValues(
  left: string | number | boolean,
  right: string | number | boolean,
  operator: ConditionOperator,
): boolean {
  if (operator === "contains") return String(left).includes(String(right));
  if (operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  if (typeof left !== "number" || typeof right !== "number" || Number.isNaN(left) || Number.isNaN(right)) return false;
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  return left <= right;
}
