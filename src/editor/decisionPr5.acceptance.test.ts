import { describe, expect, it } from "vitest";
import { createSamplePatternSet } from "./patternLibrary";
import { createGuardBehaviorGraph } from "./sampleProject";
import { formatConsiderationBrief, parseRangeLabel, resolveConsiderationRange } from "./domain";
import { decisionCanvasBrief } from "./behaviorUi";
import {
  evaluateDecision,
  normalizeByPreset,
  formatScore,
} from "./utilitySimulation";

describe("PR5 Utility Simulation / Decision Trace", () => {
  it("normalizes presets closer_is_better / farther / higher / lower / when_true / when_false", () => {
    const range = { min: 0, max: 10 };
    expect(normalizeByPreset(0, "closer_is_better", range)).toBeCloseTo(1);
    expect(normalizeByPreset(10, "closer_is_better", range)).toBeCloseTo(0);
    expect(normalizeByPreset(10, "farther", range)).toBeCloseTo(1);
    expect(normalizeByPreset(0, "higher", range)).toBeCloseTo(0);
    expect(normalizeByPreset(10, "higher", range)).toBeCloseTo(1);
    expect(normalizeByPreset(0, "lower", range)).toBeCloseTo(1);
    expect(normalizeByPreset(1, "when_true", range)).toBe(1);
    expect(normalizeByPreset(0, "when_true", range)).toBe(0);
    expect(normalizeByPreset(1, "when_false", range)).toBe(0);
    expect(normalizeByPreset(0, "when_false", range)).toBe(1);
  });

  it("stores and displays consideration range as structured {min,max,unit}", () => {
    expect(parseRangeLabel("0~10m")).toEqual({ min: 0, max: 10, unit: "m" });
    const graph = createGuardBehaviorGraph();
    const decide = graph.nodes.find((node) => node.name === "행동 판단")!;
    const attack = decide.domain?.candidates?.find((c) => c.actionNodeId === "guard-attack");
    expect(attack).toBeTruthy();
    const consideration = attack!.considerations[0];
    expect(consideration).toBeTruthy();
    expect(consideration!.range).toEqual({ min: 0, max: 10, unit: "m" });
    expect(consideration!.rangeLabel).toBeUndefined();
    expect(formatConsiderationBrief(consideration!)).toBe(
      "플레이어 거리 → 0~10m · 가까울수록 · 영향도 높음",
    );
    expect(resolveConsiderationRange(consideration!)?.unit).toBe("m");
  });

  it("evaluates Decision: hard exclude → score → pick max with Decision Trace", () => {
    const set = createSamplePatternSet();
    const graph = set.graphs[0]!;
    const decide = graph.nodes.find((node) => node.name === "행동 판단")!;
    const names = Object.fromEntries(graph.nodes.map((n) => [n.id, n.name]));

    // Default context: distance 8, ally 1, hp 100, cooldown true
    const trace = evaluateDecision(decide, set.blackboard, (id) => names[id] ?? id)!;
    expect(trace.candidates).toHaveLength(3);
    expect(trace.candidates.every((c) => c.hardResults.every((h) => typeof h.passed === "boolean"))).toBe(true);

    // Attack not excluded (cooldown true); retreat may score low because HP high
    const attack = trace.candidates.find((c) => c.actionName === "공격")!;
    expect(attack.excluded).toBe(false);
    expect(attack.finalScore).not.toBeNull();
    expect(attack.considerations[0]?.direction).toBe("closer_is_better");
    expect(attack.considerations[0]?.inputRaw).toBe("8");

    // Force cooldown false → attack excluded
    const blocked = set.blackboard.map((entry) =>
      entry.key === "CooldownReady" ? { ...entry, liveValue: "false" } : entry,
    );
    const blockedTrace = evaluateDecision(decide, blocked, (id) => names[id] ?? id)!;
    const blockedAttack = blockedTrace.candidates.find((c) => c.actionName === "공격")!;
    expect(blockedAttack.excluded).toBe(true);
    expect(blockedAttack.finalScore).toBeNull();
    expect(blockedAttack.statusReason).toMatch(/제외 \(점수 없음\)/);

    // Low HP favors retreat
    const lowHp = set.blackboard.map((entry) => {
      if (entry.key === "내 HP") return { ...entry, liveValue: "10" };
      if (entry.key === "플레이어 거리") return { ...entry, liveValue: "20" };
      if (entry.key === "CooldownReady") return { ...entry, liveValue: "false" };
      if (entry.key === "아군 수") return { ...entry, liveValue: "0" };
      return entry;
    });
    const retreatTrace = evaluateDecision(decide, lowHp, (id) => names[id] ?? id)!;
    expect(retreatTrace.selectedActionName).toBe("후퇴");
    const retreat = retreatTrace.candidates.find((c) => c.selected)!;
    expect(retreat.finalScore).toBeGreaterThan(0);
    expect(formatScore(retreat.finalScore)).toMatch(/^\d\.\d{2}$/);
  });

  it("edit-mode brief stays score-free while evaluateDecision can still compute", () => {
    const graph = createGuardBehaviorGraph();
    const decide = graph.nodes.find((node) => node.name === "행동 판단")!;
    const names = Object.fromEntries(graph.nodes.map((n) => [n.id, n.name]));
    const brief = decisionCanvasBrief(decide, (id) => names[id] ?? id)!;
    expect(brief.lines.join(" ")).not.toMatch(/\b0\.\d{2}\b/);
    const scored = evaluateDecision(
      decide,
      [
        { key: "플레이어 거리", type: "Float", defaultValue: "3", liveValue: "3", source: "t" },
        { key: "아군 수", type: "Int", defaultValue: "2", liveValue: "2", source: "t" },
        { key: "내 HP", type: "Float", defaultValue: "80", liveValue: "80", source: "t" },
        { key: "CooldownReady", type: "Bool", defaultValue: "true", liveValue: "true", source: "t" },
      ],
      (id) => names[id] ?? id,
    )!;
    expect(scored.selectedCandidateId).toBeTruthy();
  });
});

