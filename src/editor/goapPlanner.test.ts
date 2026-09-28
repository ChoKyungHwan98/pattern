import { describe, expect, it } from "vitest";
import {
  advanceExecution,
  conditionsToWorldState,
  createApproachAttackRangeExample,
  findUnmetConditions,
  formatWorldState,
  generatePlan,
  invalidateCurrentPreconditions,
  PLAN_OUTCOME_LABELS,
  worldStateToConditions,
} from "./goapPlanner";

describe("PR6 Goal / Planning (GOAP) semantic correctness", () => {
  it("HasTarget=true only yields 추적하기 → 대시 접근 → 공격 범위 진입", () => {
    const example = createApproachAttackRangeExample();
    expect(example.world.HasTarget).toBe(true);
    expect(example.world.InAttackRange).toBe(false);

    const result = generatePlan(example.goal, example.world, example.actions);
    expect(result.outcome).toBe("plan_success");
    expect(result.outcomeLabel).toBe(PLAN_OUTCOME_LABELS.plan_success);
    expect(result.failReason).toBeNull();
    expect(result.plan.map((step) => step.actionName)).toEqual([
      "추적하기",
      "대시 접근",
      "공격 범위 진입",
    ]);
    expect(result.totalCost).toBe(4);
    expect(result.finalWorld.InAttackRange).toBe(true);
    expect(result.plan[0]!.preconditions).toEqual({ HasTarget: true, Approaching: false });
    expect(result.plan[2]!.effects).toEqual({ InAttackRange: true });

    // Precondition integrity: each step's preconditions hold on stateBefore
    for (const step of result.plan) {
      for (const [key, value] of Object.entries(step.preconditions)) {
        expect(step.stateBefore[key]).toBe(value);
      }
    }
  });

  it("HasTarget=false → 계획 생성 실패 + unmet HasTarget=true", () => {
    const example = createApproachAttackRangeExample();
    const world = { ...example.world, HasTarget: false };
    const result = generatePlan(example.goal, world, example.actions);
    expect(result.outcome).toBe("unreachable");
    expect(result.outcomeLabel).toBe("계획 생성 불가");
    expect(result.plan).toEqual([]);
    expect(result.failReason).toMatch(/계획 생성 실패/);
    expect(result.failReason).toMatch(/대상 발견됨=true/);
    expect(result.unmetConditions).toContain("대상 발견됨=true");
    expect(findUnmetConditions(example.goal, world, example.actions)).toContain("대상 발견됨=true");
  });

  it("InAttackRange=true → 이미 목표 달성", () => {
    const example = createApproachAttackRangeExample();
    const world = { ...example.world, InAttackRange: true };
    const result = generatePlan(example.goal, world, example.actions);
    expect(result.outcome).toBe("already_achieved");
    expect(result.outcomeLabel).toBe("이미 목표 달성");
    expect(result.plan).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.outcomeReason).toMatch(/이미/);
  });

  it("mid-exec precondition invalidate → 실행 중 조건 무효화 + 재계획 필요", () => {
    const example = createApproachAttackRangeExample();
    let result = generatePlan(example.goal, example.world, example.actions);
    expect(result.outcome).toBe("plan_success");
    expect(result.executionIndex).toBe(0);

    // Invalidate while on first step: HasTarget disappears
    const brokenWorld = { ...result.plan[0]!.stateBefore, HasTarget: false };
    result = invalidateCurrentPreconditions(result, brokenWorld);
    expect(result.outcome).toBe("precondition_invalidated");
    expect(result.outcomeLabel).toBe("실행 중 조건 무효화");
    expect(result.failReason).toMatch(/조건 무효화/);
    expect(result.unmetConditions.some((item) => item.includes("대상 발견됨") || item.includes("HasTarget"))).toBe(true);
    expect(result.replanReason).toMatch(/재계획 필요/);
    expect(result.trace.some((entry) => entry.outcome === "replan_needed")).toBe(true);
    expect(result.trace.some((entry) => entry.kind === "invalidate")).toBe(true);
  });

  it("records replan reason in Plan Trace", () => {
    const example = createApproachAttackRangeExample();
    const result = generatePlan(example.goal, example.world, example.actions, {
      replanReason: "목표가 변경됨",
    });
    expect(result.replanReason).toBe("목표가 변경됨");
    expect(result.trace[0]?.kind).toBe("replan");
    expect(result.trace[0]?.message).toMatch(/재계획 필요/);
  });

  it("advances execution index along the plan", () => {
    const example = createApproachAttackRangeExample();
    let result = generatePlan(example.goal, example.world, example.actions);
    expect(result.executionIndex).toBe(0);
    result = advanceExecution(result);
    expect(result.executionIndex).toBe(1);
    expect(result.trace.at(-1)?.actionName).toBe("대시 접근");
  });

  it("Condition Builder rows convert to/from WorldState", () => {
    const state = { HasTarget: true, Range: 3 };
    const conditions = worldStateToConditions(state);
    expect(conditionsToWorldState(conditions)).toEqual(state);
    expect(formatWorldState(state)).toBe("대상 발견됨=true, Range=3");
  });

  it("goal desiredConditions drive planning (not raw expression)", () => {
    const example = createApproachAttackRangeExample();
    expect(example.goal.desiredConditions.length).toBeGreaterThan(0);
    expect(example.goal.intent.length).toBeGreaterThan(0);
    const withoutLegacy = {
      ...example.goal,
      desired: undefined,
    };
    const result = generatePlan(withoutLegacy, example.world, example.actions);
    expect(result.outcome).toBe("plan_success");
    expect(result.plan.map((s) => s.actionName)).toEqual([
      "추적하기",
      "대시 접근",
      "공격 범위 진입",
    ]);
  });
});
