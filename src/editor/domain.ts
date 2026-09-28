/**
 * Pattern Designer PR2–PR4 — authoring domain model.
 * PR3 Behavior Canvas presents State as Situation(상황) in product UI.
 * PR4 Decision System: Decision → Candidates → Considerations → (internal Score).
 * Flow Condition (Situation→…) stays on graph edges; Utility Score is separate.
 *
 * GraphDefinition remains the edit/runtime source of truth for IR export and
 * Cinder Knight samples. PatternDefinition is dual-written on save so later
 * PRs can migrate without breaking schemaVersion 2 IR.
 *
 * GraphNodeKind ↔ domain mapping (gradual migration):
 * | Domain     | GraphNodeKind / storage                                      |
 * |------------|--------------------------------------------------------------|
 * | State      | kind "state" + domain.entityKind "state"                     |
 * | Action     | BT: kind "task"; SM: kind "state" + entityKind "action"      |
 * | Decision   | BT: kind "selector"; SM: kind "state" + entityKind "decision"|
 * |            | domain.decisionKind = "UTILITY" | "SELECTOR"                 |
 * |            | candidates[] with hardRequirements + considerations          |
 * | Condition  | kind "condition" node and/or free-form expression on entity  |
 * | Variable   | PatternSet.blackboard (BlackboardEntry)                      |
 * | Goal/GOAP  | stub fields only — no planner/runtime in PR4                 |
 */

import { contextKeyDisplayName } from "./contextLabels";
import type { BlackboardEntry, GraphDefinition, GraphNode, GraphNodeKind, PatternSet, Point } from "./model";

export const PATTERN_DEFINITION_SCHEMA_VERSION = 1 as const;

export type DecisionKind = "UTILITY" | "SELECTOR";
export type DomainEntityKind = "state" | "action" | "decision";

/** Planner-facing influence — never shown as raw math in default Inspector. */
export type InfluenceLevel = "high" | "medium" | "low";

/**
 * Consideration evaluation style (평가 방식).
 * UI: 변수 → 평가 방식 → 범위/기준 → 영향도
 */
export type ConsiderationEvalStyle =
  | "closer_better"
  | "farther_better"
  | "higher_better"
  | "lower_better"
  | "in_range"
  | "above"
  | "below"
  | "equals"
  | "when_true"
  | "when_false";

export type HardRequirementOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_true"
  | "is_false";

/** Gate — if unmet, the candidate is excluded before scoring. */
export interface HardRequirement {
  id: string;
  variableKey: string;
  operator: HardRequirementOperator;
  /** Comparison value when operator needs one (eq/neq/gt/…). */
  value?: string;
}

/**
 * Soft scoring factor. Planner edits Korean criteria only;
 * internalWeight / internalCurve are derived and hidden by default.
 */
/** Structured consideration window — UI formats as e.g. "0~10m". */
export interface ConsiderationRange {
  min: number;
  max: number;
  unit?: string;
}

export interface Consideration {
  id: string;
  variableKey: string;
  evalStyle: ConsiderationEvalStyle;
  /** Structured range { min, max, unit }. Prefer this over legacy string fields. */
  range?: ConsiderationRange;
  /**
   * @deprecated Legacy free-form label e.g. "0~10m". Migrated into range on normalize.
   */
  rangeLabel?: string;
  /** @deprecated use range.min */
  rangeMin?: number;
  /** @deprecated use range.max */
  rangeMax?: number;
  /** @deprecated use range / threshold via range.max */
  threshold?: number;
  influence: InfluenceLevel;
  /** Internal only — mapped from influence; not edited in default Inspector. */
  internalWeight?: number;
  /** Internal only — mapped from evalStyle. */
  internalCurve?: "linear" | "inverse" | "clamp";
}

/** One selectable action/situation under a Decision. */
export interface DecisionCandidate {
  id: string;
  /** Target action or situation graph node id. */
  actionNodeId: string;
  hardRequirements: HardRequirement[];
  considerations: Consideration[];
}

export interface TimingSpec {
  /** Nominal duration in milliseconds. */
  durationMs?: number;
  /** Minimum dwell / execution time. */
  minMs?: number;
  /** Optional upper bound before forced completion. */
  maxMs?: number;
}

export interface Condition {
  id: string;
  name: string;
  /** Free-form expression; evaluation lands in a later PR. */
  expression: string;
}

export interface Variable {
  id: string;
  key: string;
  type: BlackboardEntry["type"];
  defaultValue: string;
  description?: string;
  enumValues?: string[];
}

export interface Action {
  id: string;
  name: string;
  conditionExpression?: string;
  timing?: TimingSpec;
  catalogActionId?: string;
  graphNodeId?: string;
}

export interface State {
  id: string;
  name: string;
  conditionExpression?: string;
  timing?: TimingSpec;
  actionIds?: string[];
  graphNodeId?: string;
}

export interface Decision {
  id: string;
  name: string;
  kind: DecisionKind;
  /**
   * Optional author note — NOT a Flow Condition.
   * Flow Situation→ edges keep readable conditions separately.
   */
  conditionExpression?: string;
  /** PR4 structured candidates (hard gates + considerations). */
  candidates: DecisionCandidate[];
  /**
   * Legacy optionKey → weight stub. Prefer considerations / internalWeight.
   * Kept for GraphDefinition / PatternDefinition compat.
   */
  weights?: Record<string, number>;
  /** Legacy flat candidate node ids — migrated into candidates[]. */
  candidateActionIds?: string[];
  graphNodeId?: string;
}

/** Stub only — full GOAP goals arrive in a later PR. */
export interface GoalStub {
  id: string;
  name: string;
  priority?: number;
}

/** Stub only — full GOAP planner is not implemented in PR4. */
export interface GoapStub {
  enabled?: boolean;
  goals?: GoalStub[];
}

export interface PatternDefinition {
  schemaVersion: typeof PATTERN_DEFINITION_SCHEMA_VERSION;
  id: string;
  name: string;
  description?: string;
  graphId: string;
  states: State[];
  actions: Action[];
  decisions: Decision[];
  conditions: Condition[];
  variables: Variable[];
  goals?: GoalStub[];
  goap?: GoapStub;
}

/** Per-node domain payload stored on GraphNode.domain (additive). */
export interface NodeDomainPayload {
  entityKind: DomainEntityKind;
  /** Advanced raw expression — prefer structured condition builder in UI. */
  conditionExpression?: string;
  timing?: TimingSpec;
  decisionKind?: DecisionKind;
  weights?: Record<string, number>;
  /** Action: designer-facing intent copy. */
  intent?: string;
  /** Action: catalog / execute binding name (mirrors GraphNode.action when set). */
  executeAction?: string;
  /** Action: when this action is considered done. */
  completionCondition?: string;
  /** Action: whether higher-priority flow may interrupt. Default true. */
  interruptible?: boolean;
  /** Decision: ordered candidate action / situation node ids (legacy flat). */
  candidateActionIds?: string[];
  /** Decision PR4: structured candidates with gates + considerations. */
  candidates?: DecisionCandidate[];
}

export function defaultDomainPayload(entityKind: DomainEntityKind): NodeDomainPayload {
  if (entityKind === "decision") {
    return {
      entityKind,
      decisionKind: "SELECTOR",
      weights: {},
      timing: {},
      candidateActionIds: [],
      candidates: [],
    };
  }
  if (entityKind === "action") {
    return { entityKind, timing: {}, interruptible: true };
  }
  return { entityKind, timing: {} };
}

/**
 * Resolve the authoring domain kind for a graph node.
 * Legacy nodes without domain payload are inferred from GraphNodeKind.
 */
export function resolveDomainEntityKind(node: GraphNode): DomainEntityKind | undefined {
  if (node.domain?.entityKind) return node.domain.entityKind;
  switch (node.kind) {
    case "state":
      return "state";
    case "task":
      return "action";
    case "selector":
      return "decision";
    default:
      return undefined;
  }
}

export function graphKindForDomain(
  entityKind: DomainEntityKind,
  mode: GraphDefinition["mode"],
): GraphNodeKind {
  if (mode === "bt") {
    if (entityKind === "action") return "task";
    if (entityKind === "decision") return "selector";
    // State inside a BT is uncommon; keep as task with domain override.
    return "task";
  }
  // State-machine graphs stay on kind "state" so existing SM validation/runtime keep working.
  return "state";
}

export function createDomainGraphNode(options: {
  mode: GraphDefinition["mode"];
  entityKind: DomainEntityKind;
  index: number;
  scopeId?: string;
  position: Point;
  id?: string;
}): GraphNode {
  const { mode, entityKind, index, scopeId, position } = options;
  const kind = graphKindForDomain(entityKind, mode);
  const labels: Record<DomainEntityKind, { name: string; subtitle: string }> = {
    state: { name: `새 상황 ${index}`, subtitle: "상황" },
    action: { name: `새 행동 ${index}`, subtitle: "행동" },
    decision: { name: `새 판단 ${index}`, subtitle: "판단" },
  };
  const label = labels[entityKind];
  return {
    id: options.id ?? `${mode}-node-${crypto.randomUUID()}`,
    name: label.name,
    kind,
    scopeId: mode === "bt" ? undefined : scopeId,
    position,
    subtitle: label.subtitle,
    domain: defaultDomainPayload(entityKind),
  };
}

export function ensureNodeDomain(node: GraphNode): GraphNode {
  const entityKind = resolveDomainEntityKind(node);
  if (!entityKind) return node;
  if (node.domain?.entityKind === entityKind) return node;
  const base = defaultDomainPayload(entityKind);
  return {
    ...node,
    domain: {
      ...base,
      ...node.domain,
      entityKind,
      decisionKind: node.domain?.decisionKind ?? (entityKind === "decision" ? "SELECTOR" : undefined),
    },
  };
}

export function blackboardToVariables(blackboard: BlackboardEntry[]): Variable[] {
  return blackboard.map((entry, index) => ({
    id: `var:${entry.key || index}`,
    key: entry.key,
    type: entry.type,
    defaultValue: entry.defaultValue,
    description: entry.description,
    enumValues: entry.enumValues,
  }));
}

export function buildPatternDefinition(
  graph: GraphDefinition,
  blackboard: BlackboardEntry[],
): PatternDefinition {
  const states: State[] = [];
  const actions: Action[] = [];
  const decisions: Decision[] = [];
  const conditions: Condition[] = [];

  for (const node of graph.nodes.map(ensureNodeDomain)) {
    const entityKind = resolveDomainEntityKind(node);
    const conditionExpression = node.domain?.conditionExpression;
    const timing = node.domain?.timing;

    if (entityKind === "state") {
      states.push({
        id: `state:${node.id}`,
        name: node.name,
        conditionExpression,
        timing,
        actionIds: node.actions?.map((binding) => binding.actionId),
        graphNodeId: node.id,
      });
    } else if (entityKind === "action") {
      actions.push({
        id: `action:${node.id}`,
        name: node.name,
        conditionExpression,
        timing,
        catalogActionId: node.action,
        graphNodeId: node.id,
      });
    } else if (entityKind === "decision") {
      const candidates = normalizeDecisionCandidates(node.domain);
      decisions.push({
        id: `decision:${node.id}`,
        name: node.name,
        kind: node.domain?.decisionKind ?? "SELECTOR",
        conditionExpression,
        candidates,
        candidateActionIds: candidates.map((item) => item.actionNodeId).filter(Boolean),
        weights: node.domain?.weights ?? {},
        graphNodeId: node.id,
      });
    }

    if (node.kind === "condition") {
      conditions.push({
        id: `condition:${node.id}`,
        name: node.name,
        expression: conditionExpression || node.action || node.decorators?.[0] || "",
      });
    }
  }

  return {
    schemaVersion: PATTERN_DEFINITION_SCHEMA_VERSION,
    id: `pattern-def:${graph.id}`,
    name: graph.name,
    description: graph.description,
    graphId: graph.id,
    states,
    actions,
    decisions,
    conditions,
    variables: blackboardToVariables(blackboard),
    // Goal / GOAP stubs reserved for later PRs
    goals: [],
    goap: { enabled: false, goals: [] },
  };
}

export function syncPatternDefinitions<T extends Pick<PatternSet, "graphs" | "blackboard">>(
  set: T,
): T & { patternDefinitions: PatternDefinition[] } {
  return {
    ...set,
    patternDefinitions: set.graphs.map((graph) => buildPatternDefinition(graph, set.blackboard)),
  };
}


export const INFLUENCE_LABELS: Record<InfluenceLevel, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export const EVAL_STYLE_LABELS: Record<ConsiderationEvalStyle, string> = {
  closer_better: "가까울수록",
  farther_better: "멀수록",
  higher_better: "높을수록",
  lower_better: "낮을수록",
  in_range: "범위 안",
  above: "기준 이상",
  below: "기준 이하",
  equals: "같을 때",
  when_true: "참일 때",
  when_false: "거짓일 때",
};

export const HARD_REQUIREMENT_OPERATOR_LABELS: Record<HardRequirementOperator, string> = {
  eq: "==",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  is_true: "참",
  is_false: "거짓",
};

/** Map planner influence to hidden internal weight (default Inspector never shows this). */
export function influenceToInternalWeight(influence: InfluenceLevel): number {
  switch (influence) {
    case "high":
      return 1;
    case "medium":
      return 0.6;
    case "low":
      return 0.3;
  }
}

export function evalStyleToInternalCurve(
  style: ConsiderationEvalStyle,
): NonNullable<Consideration["internalCurve"]> {
  switch (style) {
    case "closer_better":
    case "lower_better":
    case "below":
      return "inverse";
    case "in_range":
    case "equals":
    case "when_true":
    case "when_false":
      return "clamp";
    default:
      return "linear";
  }
}

export function createHardRequirement(partial?: Partial<HardRequirement>): HardRequirement {
  return {
    id: partial?.id ?? `req-${crypto.randomUUID()}`,
    variableKey: partial?.variableKey ?? "",
    operator: partial?.operator ?? "eq",
    value: partial?.value,
  };
}

export function createConsideration(partial?: Partial<Consideration>): Consideration {
  const influence = partial?.influence ?? "medium";
  const evalStyle = partial?.evalStyle ?? "higher_better";
  return migrateConsiderationRange({
    id: partial?.id ?? `con-${crypto.randomUUID()}`,
    variableKey: partial?.variableKey ?? "",
    evalStyle,
    range: partial?.range,
    rangeLabel: partial?.rangeLabel,
    rangeMin: partial?.rangeMin,
    rangeMax: partial?.rangeMax,
    threshold: partial?.threshold,
    influence,
    internalWeight: partial?.internalWeight ?? influenceToInternalWeight(influence),
    internalCurve: partial?.internalCurve ?? evalStyleToInternalCurve(evalStyle),
  });
}

export function createDecisionCandidate(partial?: Partial<DecisionCandidate>): DecisionCandidate {
  return {
    id: partial?.id ?? `cand-${crypto.randomUUID()}`,
    actionNodeId: partial?.actionNodeId ?? "",
    hardRequirements: partial?.hardRequirements ?? [],
    considerations: partial?.considerations ?? [],
  };
}

/** Apply hidden math mapping whenever a consideration is edited in the Inspector. */
export function withInternalScoring(consideration: Consideration): Consideration {
  const migrated = migrateConsiderationRange(consideration);
  return {
    ...migrated,
    internalWeight: influenceToInternalWeight(migrated.influence),
    internalCurve: evalStyleToInternalCurve(migrated.evalStyle),
  };
}

/**
 * Normalize Decision domain payload: prefer structured candidates[];
 * migrate legacy candidateActionIds when candidates are absent.
 */
export function normalizeDecisionCandidates(
  domain: Pick<NodeDomainPayload, "candidates" | "candidateActionIds"> | undefined | null,
): DecisionCandidate[] {
  if (domain?.candidates && domain.candidates.length > 0) {
    return domain.candidates.map((candidate) => ({
      ...candidate,
      hardRequirements: candidate.hardRequirements ?? [],
      considerations: (candidate.considerations ?? []).map(withInternalScoring),
    }));
  }
  return (domain?.candidateActionIds ?? [])
    .filter((actionNodeId) => actionNodeId !== undefined && actionNodeId !== null)
    .map((actionNodeId) => createDecisionCandidate({ actionNodeId }));
}

/** Sync legacy flat ids from structured candidates for older readers. */
export function candidateActionIdsFromCandidates(candidates: DecisionCandidate[]): string[] {
  return candidates.map((item) => item.actionNodeId).filter(Boolean);
}

export function formatHardRequirementBrief(requirement: HardRequirement): string {
  const key = contextKeyDisplayName(requirement.variableKey.trim() || "문맥 값");
  const op = HARD_REQUIREMENT_OPERATOR_LABELS[requirement.operator];
  if (requirement.operator === "is_true" || requirement.operator === "is_false") {
    return `${key} ${op}`;
  }
  const value = (requirement.value ?? "").trim();
  return value ? `${key} ${op} ${value}` : `${key} ${op}`;
}

/** Format structured range for UI: {min:0,max:10,unit:"m"} → "0~10m". */
export function formatRangeDisplay(range: ConsiderationRange | undefined | null): string {
  if (!range) return "";
  const unit = range.unit?.trim() ?? "";
  return `${range.min}~${range.max}${unit}`;
}

/**
 * Parse legacy authoring strings into structured range.
 * Supports "0~10m", "0~30", "1+", "8m+", "30".
 */
export function parseRangeLabel(label: string | undefined | null): ConsiderationRange | undefined {
  if (!label) return undefined;
  const trimmed = label.trim();
  if (!trimmed) return undefined;

  const plusUnit = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%]*)\+$/);
  if (plusUnit) {
    const min = Number(plusUnit[1]);
    const unit = plusUnit[2] || undefined;
    const max = min + Math.max(10, min);
    return { min, max, unit };
  }

  const plusBare = trimmed.match(/^(\d+(?:\.\d+)?)\+$/);
  if (plusBare) {
    const min = Number(plusBare[1]);
    return { min, max: min + Math.max(10, min) };
  }

  const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[~\-–—]\s*(-?\d+(?:\.\d+)?)\s*([a-zA-Z%]*)?$/);
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2]),
      unit: rangeMatch[3] || undefined,
    };
  }

  const single = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z%]*)?$/);
  if (single) {
    const value = Number(single[1]);
    return { min: 0, max: value, unit: single[2] || undefined };
  }
  return undefined;
}

export function resolveConsiderationRange(consideration: Consideration): ConsiderationRange | undefined {
  if (consideration.range && Number.isFinite(consideration.range.min) && Number.isFinite(consideration.range.max)) {
    return {
      min: consideration.range.min,
      max: consideration.range.max,
      unit: consideration.range.unit,
    };
  }
  if (consideration.rangeMin !== undefined && consideration.rangeMax !== undefined) {
    return { min: consideration.rangeMin, max: consideration.rangeMax };
  }
  const fromLabel = parseRangeLabel(consideration.rangeLabel);
  if (fromLabel) return fromLabel;
  if (consideration.threshold !== undefined) {
    return { min: 0, max: consideration.threshold };
  }
  return undefined;
}

/** Normalize legacy string/min/max fields into structured range. */
export function migrateConsiderationRange(consideration: Consideration): Consideration {
  const range = resolveConsiderationRange(consideration);
  const rest: Consideration = {
    id: consideration.id,
    variableKey: consideration.variableKey,
    evalStyle: consideration.evalStyle,
    influence: consideration.influence,
    internalWeight: consideration.internalWeight,
    internalCurve: consideration.internalCurve,
  };
  if (!range) return rest;
  return { ...rest, range };
}

/** Planner sentence: 변수 → 0~10m · 가까울수록 · 영향도 높음 */
export function formatConsiderationBrief(consideration: Consideration): string {
  const migrated = migrateConsiderationRange(consideration);
  const variable = contextKeyDisplayName(migrated.variableKey.trim() || "문맥 값");
  const style = EVAL_STYLE_LABELS[migrated.evalStyle];
  const range = formatRangeDisplay(resolveConsiderationRange(migrated));
  const influence = INFLUENCE_LABELS[migrated.influence];
  return range
    ? `${variable} → ${range} · ${style} · 영향도 ${influence}`
    : `${variable} → ${style} · 영향도 ${influence}`;
}

export function formatCandidateCriteriaBrief(candidate: DecisionCandidate, maxItems = 2): string {
  const parts = [
    ...candidate.hardRequirements.map(formatHardRequirementBrief),
    ...candidate.considerations.map(formatConsiderationBrief),
  ].filter(Boolean);
  if (parts.length === 0) return "기준 없음";
  if (parts.length <= maxItems) return parts.join(" · ");
  return `${parts.slice(0, maxItems).join(" · ")} 외 ${parts.length - maxItems}`;
}

export function domainEntityLabel(kind: DomainEntityKind): string {
  switch (kind) {
    case "state":
      return "상황";
    case "action":
      return "행동";
    case "decision":
      return "판단";
  }
}