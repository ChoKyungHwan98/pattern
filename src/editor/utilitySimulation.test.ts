import { describe, expect, it } from "vitest";
import {
  evaluateHardRequirement,
  scoreConsideration,
  normalizeByPreset,
  parseNumericInput,
} from "./utilitySimulation";
import { createConsideration, createHardRequirement } from "./domain";

describe("utilitySimulation unit", () => {
  it("parses numeric inputs with unit suffixes", () => {
    expect(parseNumericInput("5m")).toBe(5);
    expect(parseNumericInput("true")).toBe(1);
    expect(parseNumericInput("false")).toBe(0);
  });

  it("evaluates hard requirements", () => {
    const ctx = { CooldownReady: "true", "아군 수": "2" };
    expect(evaluateHardRequirement(
      createHardRequirement({ variableKey: "CooldownReady", operator: "is_true" }),
      ctx,
    ).passed).toBe(true);
    expect(evaluateHardRequirement(
      createHardRequirement({ variableKey: "아군 수", operator: "gt", value: "0" }),
      ctx,
    ).passed).toBe(true);
    expect(evaluateHardRequirement(
      createHardRequirement({ variableKey: "아군 수", operator: "gt", value: "5" }),
      ctx,
    ).passed).toBe(false);
  });

  it("scores consideration with weight from influence", () => {
    const consideration = createConsideration({
      variableKey: "플레이어 거리",
      evalStyle: "closer_better",
      range: { min: 0, max: 10, unit: "m" },
      influence: "high",
    });
    const trace = scoreConsideration(consideration, { "플레이어 거리": "0" });
    expect(trace.normalized).toBeCloseTo(1);
    expect(trace.weight).toBe(1);
    expect(trace.partialScore).toBeCloseTo(1);
    expect(trace.direction).toBe("closer_is_better");
  });

  it("clamps normalize outside range", () => {
    expect(normalizeByPreset(-5, "higher", { min: 0, max: 10 })).toBe(0);
    expect(normalizeByPreset(50, "higher", { min: 0, max: 10 })).toBe(1);
  });
});
