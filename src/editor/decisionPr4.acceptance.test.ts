import { describe, expect, it } from "vitest";
import { decisionCanvasBrief } from "./behaviorUi";
import {
  buildPatternDefinition,
  formatConsiderationBrief,
  normalizeDecisionCandidates,
} from "./domain";
import { createSamplePatternSet } from "./patternLibrary";
import { createGuardBehaviorGraph } from "./sampleProject";
import { summarizeTransition } from "./transitionSemantics";
import { isDecisionCandidateEdge } from "./behaviorUi";

describe("PR4 Decision System acceptance", () => {
  it("keeps Flow Condition edges separate from Decision utility considerations", () => {
    const graph = createGuardBehaviorGraph();
    const decide = graph.nodes.find((node) => node.name === "행동 판단")!;
    const flowToAttack = graph.edges.find((edge) => edge.id === "guard-e3")!;

    // Decision → Candidate Action edges are candidate links (no IF/ELSE flow labels)
    expect(isDecisionCandidateEdge(graph, flowToAttack)).toBe(true);
    expect(summarizeTransition(flowToAttack)).toBe("항상");

    // Situation → Situation keeps readable flow condition
    const patrolToAlert = graph.edges.find((edge) => edge.id === "guard-e1")!;
    expect(isDecisionCandidateEdge(graph, patrolToAlert)).toBe(false);
    expect(summarizeTransition(patrolToAlert)).toContain("플레이어 발견");

    // Decision scoring criteria live on candidates, not on the edge
    const attackCandidate = normalizeDecisionCandidates(decide.domain).find(
      (item) => item.actionNodeId === "guard-attack",
    );
    expect(attackCandidate).toBeTruthy();
    expect(attackCandidate!.hardRequirements[0]?.variableKey).toBe("CooldownReady");
    expect(formatConsiderationBrief(attackCandidate!.considerations[0]!)).toBe(
      "플레이어 거리 → 0~10m · 가까울수록 · 영향도 높음",
    );
  });

  it("canvas Decision brief shows candidates + criteria, not live final scores", () => {
    const graph = createGuardBehaviorGraph();
    const decide = graph.nodes.find((node) => node.name === "행동 판단")!;
    const names = Object.fromEntries(graph.nodes.map((node) => [node.id, node.name]));
    const brief = decisionCanvasBrief(decide, (id) => names[id] ?? id)!;

    expect(brief.headline).toContain("후보 3");
    expect(brief.headline).not.toMatch(/점수\s*[:·]/);
    expect(brief.lines.some((line) => line.includes("공격"))).toBe(true);
    expect(brief.lines.join(" ")).not.toMatch(/\b0\.\d+\b/);
    expect(brief.lines.join(" ")).not.toContain("internalWeight");
  });

  it("PatternDefinition dual-write carries structured candidates", () => {
    const set = createSamplePatternSet();
    const guard = set.graphs[0]!;
    const definition = buildPatternDefinition(guard, set.blackboard);
    const decision = definition.decisions.find((item) => item.name === "행동 판단");
    expect(decision?.candidates.length).toBe(3);
    expect(decision?.candidateActionIds).toEqual([
      "guard-attack",
      "guard-support",
      "guard-retreat",
    ]);
    expect(set.blackboard.some((entry) => entry.key === "CooldownReady")).toBe(true);
  });
});
