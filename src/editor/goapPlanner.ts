/**
 * PR6 Goal / Planning (GOAP-style) — plan generation + Plan Trace only.
 *
 * Separate from Utility Decision scoring. No HTN / EQS / Influence / Steering /
 * AI Review / game runtime. No auto-wire Utility → GOAP.
 *
 * User language: 목표 / 현재 상황·문맥 / 실행 조건 / 실행 결과 / 비용 / 계획
 */

import type { HardRequirement } from "./domain";
import { formatContextFact, formatContextState } from "./contextLabels";
import { createHardRequirement, formatHardRequirementBrief } from "./domain";

export type WorldValue = boolean | number | string;
export type WorldState = Record<string, WorldValue>;

/** Structured world condition — Condition Builder shape (Context vars, not raw expression). */
export type WorldCondition = HardRequirement;

/** 목표 — name, intent, desired world conditions. */
export interface GoapGoal {
  id: string;
  /** Designer-facing name, e.g. 공격 가능한 거리까지 접근 */
  name: string;
  /** Intent / description for authors. */
  intent: string;
  /**
   * Desired world facts as Condition Builder rows (AND).
   * Preferred over legacy `desired` map.
   */
  desiredConditions: WorldCondition[];
  /**
   * @deprecated Prefer desiredConditions. Kept for compact WorldState views / tests.
   * When present alongside desiredConditions, desiredConditions wins for planning.
   */
  desired?: WorldState;
}

/** 계획 행동 — preconditions / effects / cost. */
export interface GoapAction {
  id: string;
  name: string;
  /** 실행 조건 — Condition Builder rows */
  preconditionConditions: WorldCondition[];
  /** 실행 결과 — Condition Builder rows interpreted as assignments */
  effectConditions: WorldCondition[];
  /** 비용 (낮을수록 선호) */
  cost: number;
  /** @deprecated Prefer preconditionConditions */
  preconditions?: WorldState;
  /** @deprecated Prefer effectConditions */
  effects?: WorldState;
}

export interface PlanStep {
  actionId: string;
  actionName: string;
  stateBefore: WorldState;
  stateAfter: WorldState;
  cost: number;
  preconditions: WorldState;
  effects: WorldState;
}

/**
 * Distinct Plan Trace / plan outcomes (PR6).
 * Each carries a human reason string in PlanResult.
 */
export type PlanOutcome =
  | "plan_success"
  | "already_achieved"
  | "unreachable"
  | "precondition_invalidated"
  | "replan_needed";

export const PLAN_OUTCOME_LABELS: Record<PlanOutcome, string> = {
  plan_success: "계획 성공",
  already_achieved: "이미 목표 달성",
  unreachable: "계획 생성 불가",
  precondition_invalidated: "실행 중 조건 무효화",
  replan_needed: "재계획 필요",
};

/** @deprecated Use PlanOutcome. Kept for older status checks. */
export type PlanStatus = "success" | "failed" | "idle";

export interface PlanTraceEntry {
  step: number;
  kind: "expand" | "apply" | "goal-met" | "dead-end" | "replan" | "invalidate" | "outcome";
  message: string;
  actionName?: string;
  state?: WorldState;
  costSoFar?: number;
  outcome?: PlanOutcome;
}

export interface PlanResult {
  /** Distinct outcome for Plan Trace UI. */
  outcome: PlanOutcome;
  /** Korean label for outcome. */
  outcomeLabel: string;
  /** Reason shown with the outcome. */
  outcomeReason: string;
  /** Legacy coarse status derived from outcome. */
  status: PlanStatus;
  goal: GoapGoal;
  initialWorld: WorldState;
  finalWorld: WorldState;
  plan: PlanStep[];
  totalCost: number;
  /** 현재 실행 단계 index into plan (0-based). -1 = not started. */
  executionIndex: number;
  /** 계획 실패 사유 (unreachable) — includes unmet conditions */
  failReason: string | null;
  /** Unmet conditions e.g. ["HasTarget=true"] */
  unmetConditions: string[];
  /** 재계획 사유 */
  replanReason: string | null;
  /** Plan Trace 로그 */
  trace: PlanTraceEntry[];
}

function stateKey(state: WorldState): string {
  return Object.keys(state)
    .sort()
    .map((key) => `${key}=${String(state[key])}`)
    .join("|");
}

function parseConditionValue(condition: WorldCondition): WorldValue {
  if (condition.operator === "is_true") return true;
  if (condition.operator === "is_false") return false;
  const raw = (condition.value ?? "").trim();
  if (raw === "true") return true;
  if (raw === "false") return false;
  const num = Number(raw);
  if (raw !== "" && Number.isFinite(num) && String(num) === raw) return num;
  return raw;
}

/** Convert Condition Builder rows → equality WorldState (GOAP facts). */
export function conditionsToWorldState(conditions: WorldCondition[]): WorldState {
  const state: WorldState = {};
  for (const condition of conditions) {
    const key = condition.variableKey.trim();
    if (!key) continue;
    if (
      condition.operator === "is_true" ||
      condition.operator === "is_false" ||
      condition.operator === "eq"
    ) {
      state[key] = parseConditionValue(condition);
    } else {
      // Non-equality operators still pin a comparable fact for planner equality model.
      state[key] = parseConditionValue({ ...condition, operator: "eq" });
    }
  }
  return state;
}

/** Convert WorldState map → Condition Builder rows (is_true / is_false / eq). */
export function worldStateToConditions(state: WorldState): WorldCondition[] {
  return Object.entries(state).map(([key, value]) => {
    if (value === true) {
      return createHardRequirement({ variableKey: key, operator: "is_true" });
    }
    if (value === false) {
      return createHardRequirement({ variableKey: key, operator: "is_false" });
    }
    return createHardRequirement({
      variableKey: key,
      operator: "eq",
      value: String(value),
    });
  });
}

export function formatConditionBrief(condition: WorldCondition): string {
  return formatHardRequirementBrief(condition);
}

export function formatConditionsList(conditions: WorldCondition[]): string {
  if (conditions.length === 0) return "(없음)";
  return conditions.map(formatConditionBrief).join(", ");
}

function resolveDesired(goal: GoapGoal): WorldState {
  if (goal.desiredConditions && goal.desiredConditions.length > 0) {
    return conditionsToWorldState(goal.desiredConditions);
  }
  return { ...(goal.desired ?? {}) };
}

function resolvePreconditions(action: GoapAction): WorldState {
  if (action.preconditionConditions && action.preconditionConditions.length > 0) {
    return conditionsToWorldState(action.preconditionConditions);
  }
  return { ...(action.preconditions ?? {}) };
}

function resolveEffects(action: GoapAction): WorldState {
  if (action.effectConditions && action.effectConditions.length > 0) {
    return conditionsToWorldState(action.effectConditions);
  }
  return { ...(action.effects ?? {}) };
}

function matches(required: WorldState, world: WorldState): boolean {
  return Object.entries(required).every(([key, value]) => world[key] === value);
}

function applyEffects(world: WorldState, effects: WorldState): WorldState {
  return { ...world, ...effects };
}

function formatFact(key: string, value: WorldValue): string {
  // Planner-facing: Korean display name; stable key remains in WorldState data.
  return formatContextFact(key, value);
}

/**
 * Analyze why a goal is unreachable: facts required by useful actions / goal
 * that are never true in the initial world and never produced by any action effect.
 */
export function findUnmetConditions(
  goal: GoapGoal,
  world: WorldState,
  actions: GoapAction[],
): string[] {
  const desired = resolveDesired(goal);
  const produced = new Set<string>();
  for (const action of actions) {
    for (const [key, value] of Object.entries(resolveEffects(action))) {
      produced.add(formatFact(key, value));
    }
  }

  const unmet = new Set<string>();

  // Goal desires not currently true and not producible.
  for (const [key, value] of Object.entries(desired)) {
    if (world[key] === value) continue;
    const fact = formatFact(key, value);
    if (!produced.has(fact)) unmet.add(fact);
  }

  // Action preconditions that block every path from the start:
  // required, false in world, and never produced by any effect.
  for (const action of actions) {
    const pre = resolvePreconditions(action);
    for (const [key, value] of Object.entries(pre)) {
      if (world[key] === value) continue;
      const fact = formatFact(key, value);
      if (!produced.has(fact)) unmet.add(fact);
    }
  }

  // Prefer actionable unmet preconditions that appear on actions which could
  // eventually help reach the goal (effects overlap goal or feed other actions).
  if (unmet.size === 0) {
    // Fallback: list goal desires still false.
    for (const [key, value] of Object.entries(desired)) {
      if (world[key] !== value) unmet.add(formatFact(key, value));
    }
  }

  return [...unmet];
}

interface SearchNode {
  world: WorldState;
  path: GoapAction[];
  cost: number;
}

function outcomeOf(
  outcome: PlanOutcome,
  reason: string,
): Pick<PlanResult, "outcome" | "outcomeLabel" | "outcomeReason" | "status"> {
  const status: PlanStatus =
    outcome === "plan_success" || outcome === "already_achieved"
      ? "success"
      : outcome === "replan_needed" || outcome === "precondition_invalidated"
        ? "failed"
        : outcome === "unreachable"
          ? "failed"
          : "idle";
  return {
    outcome,
    outcomeLabel: PLAN_OUTCOME_LABELS[outcome],
    outcomeReason: reason,
    status,
  };
}

/**
 * Forward Dijkstra / uniform-cost search over GOAP actions.
 * Integrity: start from World State → check each Action precondition →
 * apply effects to planning state → next action.
 */
export function generatePlan(
  goal: GoapGoal,
  world: WorldState,
  actions: GoapAction[],
  options?: { replanReason?: string | null; maxNodes?: number },
): PlanResult {
  const trace: PlanTraceEntry[] = [];
  const replanReason = options?.replanReason ?? null;
  const desired = resolveDesired(goal);

  if (replanReason) {
    trace.push({
      step: 0,
      kind: "replan",
      message: `재계획 필요 · ${replanReason}`,
      outcome: "replan_needed",
    });
  }

  if (matches(desired, world)) {
    const reason = `현재 세계 상태가 이미 목표 “${goal.name}”을(를) 충족합니다.`;
    trace.push({
      step: 0,
      kind: "goal-met",
      message: `이미 목표 달성 · ${goal.name}`,
      state: { ...world },
      costSoFar: 0,
      outcome: "already_achieved",
    });
    trace.push({
      step: 0,
      kind: "outcome",
      message: `${PLAN_OUTCOME_LABELS.already_achieved}: ${reason}`,
      outcome: "already_achieved",
      state: { ...world },
    });
    return {
      ...outcomeOf("already_achieved", reason),
      goal,
      initialWorld: { ...world },
      finalWorld: { ...world },
      plan: [],
      totalCost: 0,
      executionIndex: -1,
      failReason: null,
      unmetConditions: [],
      replanReason,
      trace,
    };
  }

  const maxNodes = options?.maxNodes ?? 500;
  const open: SearchNode[] = [{ world: { ...world }, path: [], cost: 0 }];
  const bestCost = new Map<string, number>([[stateKey(world), 0]]);
  let explored = 0;
  let lastWorld = { ...world };

  while (open.length > 0 && explored < maxNodes) {
    open.sort((a, b) => a.cost - b.cost);
    const current = open.shift()!;
    explored += 1;
    lastWorld = current.world;

    if (matches(desired, current.world)) {
      const plan: PlanStep[] = [];
      let cursor = { ...world };
      for (const action of current.path) {
        const pre = resolvePreconditions(action);
        const effects = resolveEffects(action);
        // Integrity: refuse to build a plan step whose preconditions do not hold.
        if (!matches(pre, cursor)) {
          const unmet = Object.entries(pre)
            .filter(([key, value]) => cursor[key] !== value)
            .map(([key, value]) => formatFact(key, value));
          const failReason = `계획 생성 실패 · 단계 “${action.name}” 실행 조건 미충족: ${unmet.join(", ")}`;
          trace.push({
            step: explored,
            kind: "dead-end",
            message: failReason,
            actionName: action.name,
            state: { ...cursor },
            outcome: "unreachable",
          });
          return {
            ...outcomeOf("unreachable", failReason),
            goal,
            initialWorld: { ...world },
            finalWorld: cursor,
            plan: [],
            totalCost: 0,
            executionIndex: -1,
            failReason,
            unmetConditions: unmet,
            replanReason,
            trace,
          };
        }
        const before = { ...cursor };
        const after = applyEffects(cursor, effects);
        plan.push({
          actionId: action.id,
          actionName: action.name,
          stateBefore: before,
          stateAfter: after,
          cost: action.cost,
          preconditions: pre,
          effects,
        });
        cursor = after;
        trace.push({
          step: plan.length,
          kind: "apply",
          message: `계획 단계 ${plan.length}: ${action.name} (비용 ${action.cost})`,
          actionName: action.name,
          state: { ...after },
          costSoFar: plan.reduce((sum, s) => sum + s.cost, 0),
        });
      }
      const reason = `목표 “${goal.name}” 달성 · ${plan.length}단계 · 총 비용 ${current.cost}`;
      trace.push({
        step: explored,
        kind: "goal-met",
        message: reason,
        state: { ...cursor },
        costSoFar: current.cost,
        outcome: "plan_success",
      });
      trace.push({
        step: explored,
        kind: "outcome",
        message: `${PLAN_OUTCOME_LABELS.plan_success}: ${reason}`,
        outcome: "plan_success",
        state: { ...cursor },
        costSoFar: current.cost,
      });
      return {
        ...outcomeOf("plan_success", reason),
        goal,
        initialWorld: { ...world },
        finalWorld: cursor,
        plan,
        totalCost: current.cost,
        executionIndex: plan.length > 0 ? 0 : -1,
        failReason: null,
        unmetConditions: [],
        replanReason,
        trace,
      };
    }

    for (const action of actions) {
      const pre = resolvePreconditions(action);
      if (!matches(pre, current.world)) continue;
      const effects = resolveEffects(action);
      const nextWorld = applyEffects(current.world, effects);
      const nextCost = current.cost + Math.max(0, action.cost);
      const key = stateKey(nextWorld);
      const known = bestCost.get(key);
      if (known !== undefined && known <= nextCost) continue;
      bestCost.set(key, nextCost);
      trace.push({
        step: explored,
        kind: "expand",
        message: `후보 확장: ${action.name} → 누적 비용 ${nextCost}`,
        actionName: action.name,
        state: { ...nextWorld },
        costSoFar: nextCost,
      });
      open.push({
        world: nextWorld,
        path: [...current.path, action],
        cost: nextCost,
      });
    }
  }

  const unmet = findUnmetConditions(goal, world, actions);
  const unmetText =
    unmet.length > 0 ? `충족되지 않은 조건: ${unmet.join(", ")}` : "적용 가능한 행동 경로 없음";
  const failReason =
    explored >= maxNodes
      ? `계획 생성 실패 · 탐색 한도(${maxNodes}) 초과 · ${unmetText}`
      : `계획 생성 실패 · ${unmetText}`;
  trace.push({
    step: explored,
    kind: "dead-end",
    message: failReason,
    state: lastWorld,
    outcome: "unreachable",
  });
  trace.push({
    step: explored,
    kind: "outcome",
    message: `${PLAN_OUTCOME_LABELS.unreachable}: ${failReason}`,
    outcome: "unreachable",
    state: lastWorld,
  });

  return {
    ...outcomeOf("unreachable", failReason),
    goal,
    initialWorld: { ...world },
    finalWorld: lastWorld,
    plan: [],
    totalCost: 0,
    executionIndex: -1,
    failReason,
    unmetConditions: unmet,
    replanReason,
    trace,
  };
}

/** Advance execution one step (Plan Trace UI). Does not mutate planner inputs. */
export function advanceExecution(result: PlanResult): PlanResult {
  if (result.outcome !== "plan_success" || result.plan.length === 0) return result;
  const next = result.executionIndex + 1;
  if (next >= result.plan.length) {
    const reason = "모든 계획 단계를 실행했습니다.";
    return {
      ...result,
      executionIndex: result.plan.length,
      outcome: "plan_success",
      outcomeLabel: PLAN_OUTCOME_LABELS.plan_success,
      outcomeReason: reason,
      status: "success",
      trace: [
        ...result.trace,
        {
          step: result.trace.length + 1,
          kind: "goal-met",
          message: "계획 실행 완료",
          state: result.finalWorld,
          costSoFar: result.totalCost,
          outcome: "plan_success",
        },
      ],
    };
  }
  const step = result.plan[next]!;
  return {
    ...result,
    executionIndex: next,
    trace: [
      ...result.trace,
      {
        step: result.trace.length + 1,
        kind: "apply",
        message: `실행 중: ${step.actionName}`,
        actionName: step.actionName,
        state: step.stateAfter,
        costSoFar: result.plan.slice(0, next + 1).reduce((sum, s) => sum + s.cost, 0),
      },
    ],
  };
}

/**
 * Simulate mid-execution precondition invalidation for the upcoming / current step.
 * Marks outcome as 실행 중 조건 무효화 and flags 재계획 필요.
 */
export function invalidateCurrentPreconditions(
  result: PlanResult,
  worldOverride?: WorldState,
): PlanResult {
  if (result.plan.length === 0) return result;
  const index =
    result.executionIndex >= 0 && result.executionIndex < result.plan.length
      ? result.executionIndex
      : 0;
  const step = result.plan[index]!;
  const world = worldOverride ?? step.stateBefore;
  const unmet = Object.entries(step.preconditions)
    .filter(([key, value]) => world[key] !== value)
    .map(([key, value]) => formatFact(key, value));

  // If override still satisfies, force a representative unmet from the step.
  const forcedUnmet =
    unmet.length > 0
      ? unmet
      : Object.entries(step.preconditions).map(([key, value]) => formatFact(key, value));

  const invalidateReason = `실행 중 “${step.actionName}” 조건 무효화 · ${forcedUnmet.join(", ")}`;
  const replanReason = `이전 계획 무효 · ${forcedUnmet.join(", ")} 때문에 재계획 필요`;

  return {
    ...result,
    ...outcomeOf("precondition_invalidated", invalidateReason),
    failReason: invalidateReason,
    unmetConditions: forcedUnmet,
    replanReason,
    status: "failed",
    trace: [
      ...result.trace,
      {
        step: result.trace.length + 1,
        kind: "invalidate",
        message: `${PLAN_OUTCOME_LABELS.precondition_invalidated}: ${invalidateReason}`,
        actionName: step.actionName,
        state: world,
        outcome: "precondition_invalidated",
      },
      {
        step: result.trace.length + 2,
        kind: "replan",
        message: `${PLAN_OUTCOME_LABELS.replan_needed}: ${replanReason}`,
        outcome: "replan_needed",
        state: world,
      },
    ],
  };
}

/** Mark that a replan is required (e.g. after invalidation). */
export function markReplanNeeded(result: PlanResult, reason: string): PlanResult {
  return {
    ...result,
    ...outcomeOf("replan_needed", reason),
    replanReason: reason,
    status: "failed",
    trace: [
      ...result.trace,
      {
        step: result.trace.length + 1,
        kind: "replan",
        message: `${PLAN_OUTCOME_LABELS.replan_needed}: ${reason}`,
        outcome: "replan_needed",
      },
    ],
  };
}

function makeAction(partial: {
  id: string;
  name: string;
  preconditions: WorldState;
  effects: WorldState;
  cost: number;
}): GoapAction {
  return {
    id: partial.id,
    name: partial.name,
    cost: partial.cost,
    preconditions: partial.preconditions,
    effects: partial.effects,
    preconditionConditions: worldStateToConditions(partial.preconditions),
    effectConditions: worldStateToConditions(partial.effects),
  };
}

/** Built-in PR6 demo: 공격 가능한 거리까지 접근 */
export function createApproachAttackRangeExample(): {
  goal: GoapGoal;
  world: WorldState;
  actions: GoapAction[];
} {
  const desired: WorldState = { InAttackRange: true };
  return {
    goal: {
      id: "goal-approach-attack",
      name: "공격 가능한 거리까지 접근",
      intent: "대상이 있을 때 추적·대시로 공격 가능 거리까지 붙는다.",
      desired,
      desiredConditions: worldStateToConditions(desired),
    },
    world: {
      HasTarget: true,
      InAttackRange: false,
      Approaching: false,
      Dashed: false,
    },
    actions: [
      makeAction({
        id: "act-chase",
        name: "추적하기",
        preconditions: { HasTarget: true, Approaching: false },
        effects: { Approaching: true },
        cost: 2,
      }),
      makeAction({
        id: "act-dash",
        name: "대시 접근",
        preconditions: { Approaching: true, Dashed: false },
        effects: { Dashed: true },
        cost: 1,
      }),
      makeAction({
        id: "act-enter-range",
        name: "공격 범위 진입",
        preconditions: { Dashed: true, InAttackRange: false },
        effects: { InAttackRange: true },
        cost: 1,
      }),
    ],
  };
}

export function createEmptyGoal(): GoapGoal {
  return {
    id: `goal-${crypto.randomUUID()}`,
    name: "새 목표",
    intent: "",
    desiredConditions: [],
    desired: {},
  };
}

export function createEmptyAction(): GoapAction {
  return {
    id: `act-${crypto.randomUUID()}`,
    name: "새 계획 행동",
    cost: 1,
    preconditionConditions: [],
    effectConditions: [],
    preconditions: {},
    effects: {},
  };
}

export function formatWorldState(state: WorldState): string {
  return formatContextState(state);
}

/** Sync legacy WorldState mirrors from Condition Builder rows (call after edits). */
export function syncActionFromConditions(action: GoapAction): GoapAction {
  return {
    ...action,
    preconditions: conditionsToWorldState(action.preconditionConditions),
    effects: conditionsToWorldState(action.effectConditions),
  };
}

export function syncGoalFromConditions(goal: GoapGoal): GoapGoal {
  return {
    ...goal,
    desired: conditionsToWorldState(goal.desiredConditions),
  };
}
