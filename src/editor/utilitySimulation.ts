/**
 * PR5 Utility Simulation / Decision Trace.
 * Hard gates → normalize considerations (presets only) → weighted score → pick max.
 * No GOAP / Planner / custom curves.
 */

import type { BlackboardEntry } from "./model";
import {
  type Consideration,
  type ConsiderationEvalStyle,
  type DecisionCandidate,
  type HardRequirement,
  type HardRequirementOperator,
  type InfluenceLevel,
  EVAL_STYLE_LABELS,
  INFLUENCE_LABELS,
  formatHardRequirementBrief,
  formatRangeDisplay,
  influenceToInternalWeight,
  normalizeDecisionCandidates,
  resolveConsiderationRange,
  withInternalScoring,
} from "./domain";
import type { GraphNode } from "./model";
import { resolveDomainEntityKind } from "./domain";

/** Simulation presets — only these normalize paths are supported. */
export type NormalizePreset =
  | "closer_is_better"
  | "farther"
  | "higher"
  | "lower"
  | "when_true"
  | "when_false";

export const NORMALIZE_PRESET_LABELS: Record<NormalizePreset, string> = {
  closer_is_better: "가까울수록",
  farther: "멀수록",
  higher: "높을수록",
  lower: "낮을수록",
  when_true: "참일 때",
  when_false: "거짓일 때",
};

export interface HardRequirementTrace {
  requirement: HardRequirement;
  brief: string;
  actualRaw: string;
  passed: boolean;
}

export interface ConsiderationTrace {
  consideration: Consideration;
  briefVariable: string;
  inputRaw: string;
  inputNumber: number | null;
  direction: NormalizePreset;
  directionLabel: string;
  normalized: number;
  weight: number;
  partialScore: number;
}

export interface CandidateTrace {
  candidate: DecisionCandidate;
  actionNodeId: string;
  actionName: string;
  excluded: boolean;
  hardResults: HardRequirementTrace[];
  considerations: ConsiderationTrace[];
  /** null when excluded by hard requirements (no score computed) */
  finalScore: number | null;
  selected: boolean;
  /**
   * Why this candidate was / was not chosen.
   * - excluded: hard gate failed (no score)
   * - eligible 0.00: scored but lost to a higher candidate
   * - selected: max score winner
   */
  statusReason: string;
}

export interface DecisionTraceResult {
  decisionNodeId: string;
  decisionName: string;
  context: Record<string, string>;
  candidates: CandidateTrace[];
  selectedCandidateId: string | null;
  selectedActionName: string | null;
}

export function evalStyleToPreset(style: ConsiderationEvalStyle): NormalizePreset {
  switch (style) {
    case "closer_better":
      return "closer_is_better";
    case "farther_better":
      return "farther";
    case "higher_better":
    case "above":
    case "in_range":
      return "higher";
    case "lower_better":
    case "below":
      return "lower";
    case "when_true":
    case "equals":
      return "when_true";
    case "when_false":
      return "when_false";
    default:
      return "higher";
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Normalize a raw numeric (or bool-as-0/1) input to 0..1 via presets only.
 * Range {min,max} defines the interpolation window.
 */
export function normalizeByPreset(
  raw: number,
  preset: NormalizePreset,
  range: { min: number; max: number },
): number {
  if (preset === "when_true") return raw ? 1 : 0;
  if (preset === "when_false") return raw ? 0 : 1;

  const span = range.max - range.min;
  const t = span === 0 ? 0 : clamp01((raw - range.min) / span);

  switch (preset) {
    case "closer_is_better":
    case "lower":
      return clamp01(1 - t);
    case "farther":
    case "higher":
      return clamp01(t);
    default:
      return clamp01(t);
  }
}

export function readContextValue(
  context: Record<string, string> | BlackboardEntry[],
  key: string,
): string {
  if (Array.isArray(context)) {
    const entry = context.find((item) => item.key === key);
    return entry?.liveValue ?? entry?.defaultValue ?? "";
  }
  return context[key] ?? "";
}

export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "") return null;
  if (trimmed === "true") return 1;
  if (trimmed === "false") return 0;
  // Strip common unit suffixes for authoring convenience (m, %, hp, …)
  const stripped = trimmed.replace(/[a-z%]+$/i, "").trim();
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

export function evaluateHardRequirement(
  requirement: HardRequirement,
  context: Record<string, string> | BlackboardEntry[],
): HardRequirementTrace {
  const actualRaw = readContextValue(context, requirement.variableKey);
  const passed = compareHard(requirement.operator, actualRaw, requirement.value);
  return {
    requirement,
    brief: formatHardRequirementBrief(requirement),
    actualRaw: actualRaw === "" ? "(없음)" : actualRaw,
    passed,
  };
}

function compareHard(
  operator: HardRequirementOperator,
  actualRaw: string,
  expected?: string,
): boolean {
  if (operator === "is_true") {
    return actualRaw.trim().toLowerCase() === "true" || actualRaw.trim() === "1";
  }
  if (operator === "is_false") {
    const v = actualRaw.trim().toLowerCase();
    return v === "false" || v === "0" || v === "";
  }
  const leftNum = parseNumericInput(actualRaw);
  const rightNum = parseNumericInput(expected ?? "");
  const bothNumeric = leftNum !== null && rightNum !== null;
  const left = bothNumeric ? leftNum : actualRaw.trim();
  const right = bothNumeric ? rightNum : (expected ?? "").trim();

  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    default:
      return false;
  }
}

export function scoreConsideration(
  consideration: Consideration,
  context: Record<string, string> | BlackboardEntry[],
): ConsiderationTrace {
  const scored = withInternalScoring(consideration);
  const preset = evalStyleToPreset(scored.evalStyle);
  const range = resolveConsiderationRange(scored) ?? { min: 0, max: 1 };
  const inputRaw = readContextValue(context, scored.variableKey);
  const inputNumber = parseNumericInput(inputRaw);
  const rawForNorm =
    preset === "when_true" || preset === "when_false"
      ? (inputRaw.trim().toLowerCase() === "true" || inputRaw.trim() === "1" ? 1 : 0)
      : (inputNumber ?? 0);
  const normalized = normalizeByPreset(rawForNorm, preset, range);
  const weight = scored.internalWeight ?? influenceToInternalWeight(scored.influence);
  const partialScore = normalized * weight;
  return {
    consideration: scored,
    briefVariable: scored.variableKey.trim() || "변수",
    inputRaw: inputRaw === "" ? "(없음)" : inputRaw,
    inputNumber,
    direction: preset,
    directionLabel: NORMALIZE_PRESET_LABELS[preset] ?? EVAL_STYLE_LABELS[scored.evalStyle],
    normalized,
    weight,
    partialScore,
  };
}

export function scoreCandidate(
  candidate: DecisionCandidate,
  context: Record<string, string> | BlackboardEntry[],
  actionName: string,
): Omit<CandidateTrace, "selected" | "statusReason"> {
  const hardResults = candidate.hardRequirements.map((req) =>
    evaluateHardRequirement(req, context),
  );
  const excluded = hardResults.some((item) => !item.passed);
  const considerations = candidate.considerations.map((item) =>
    scoreConsideration(item, context),
  );
  let finalScore: number | null = null;
  if (!excluded) {
    const weightSum = considerations.reduce((sum, item) => sum + item.weight, 0);
    if (considerations.length === 0) {
      finalScore = 0;
    } else if (weightSum <= 0) {
      finalScore = 0;
    } else {
      finalScore =
        considerations.reduce((sum, item) => sum + item.partialScore, 0) / weightSum;
    }
  }
  return {
    candidate,
    actionNodeId: candidate.actionNodeId,
    actionName,
    excluded,
    hardResults,
    considerations,
    finalScore,
  };
}

export function blackboardToContext(blackboard: BlackboardEntry[]): Record<string, string> {
  const context: Record<string, string> = {};
  for (const entry of blackboard) {
    context[entry.key] = entry.liveValue ?? entry.defaultValue ?? "";
  }
  return context;
}

export function evaluateDecision(
  decisionNode: GraphNode,
  blackboard: BlackboardEntry[],
  resolveActionName: (nodeId: string) => string = (id) => id,
): DecisionTraceResult | undefined {
  const entity = resolveDomainEntityKind(decisionNode);
  if (entity !== "decision" && decisionNode.kind !== "selector") return undefined;

  const context = blackboardToContext(blackboard);
  const candidates = normalizeDecisionCandidates(decisionNode.domain);
  const scored = candidates.map((candidate) =>
    scoreCandidate(candidate, context, resolveActionName(candidate.actionNodeId) || candidate.actionNodeId),
  );

  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const item of scored) {
    if (item.excluded || item.finalScore === null) continue;
    if (item.finalScore > bestScore) {
      bestScore = item.finalScore;
      bestId = item.candidate.id;
    }
  }

  const withSelection: CandidateTrace[] = scored.map((item) => {
    const selected = item.candidate.id === bestId;
    let statusReason: string;
    if (item.excluded) {
      const failed = item.hardResults.filter((h) => !h.passed).map((h) => h.brief);
      statusReason = failed.length
        ? `하드 조건 미충족 → 제외 (점수 없음): ${failed.join(", ")}`
        : "하드 조건 미충족 → 제외 (점수 없음)";
    } else if (selected) {
      statusReason = `최종 점수 ${formatScore(item.finalScore)} · 최고점 선택`;
    } else if (item.finalScore === 0) {
      statusReason = "점수 0.00 · 후보 자격은 있음 · 최고점이 아니라 미선택";
    } else {
      statusReason = `점수 ${formatScore(item.finalScore)} · 최고점이 아니라 미선택`;
    }
    return { ...item, selected, statusReason };
  });

  const selected = withSelection.find((item) => item.selected);

  return {
    decisionNodeId: decisionNode.id,
    decisionName: decisionNode.name,
    context,
    candidates: withSelection,
    selectedCandidateId: bestId,
    selectedActionName: selected?.actionName ?? null,
  };
}

export function formatScore(score: number | null | undefined, digits = 2): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return "—";
  return score.toFixed(digits);
}

export function influenceLabel(level: InfluenceLevel): string {
  return INFLUENCE_LABELS[level];
}

export function formatConsiderationRangeHint(consideration: Consideration): string {
  const range = resolveConsiderationRange(consideration);
  return range ? formatRangeDisplay(range) : "";
}


