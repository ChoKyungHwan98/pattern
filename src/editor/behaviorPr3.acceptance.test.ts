import { describe, expect, it } from "vitest";
import { BEHAVIOR_PALETTE, isCanvasVisibleNode, isDecisionCandidateEdge, visibleBehaviorNodes } from "./behaviorUi";
import { createGuardBehaviorGraph } from "./sampleProject";
import { createGraph, createSamplePatternSet } from "./patternLibrary";
import { summarizeCondition, summarizeTransition } from "./transitionSemantics";

describe("PR3 Behavior Canvas acceptance", () => {
  it("creates Behavior without FSM/HFSM/BT product choice and empty visible canvas", () => {
    const graph = createGraph("state-machine", "");
    expect(graph.name).toBe("새 행동 패턴");
    expect(graph.nodes.filter((node) => node.kind === "state")).toHaveLength(0);
    expect(graph.nodes.some((node) => node.kind === "entry")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "any")).toBe(true);
    expect(visibleBehaviorNodes(graph)).toHaveLength(0);
    expect(visibleBehaviorNodes(graph).every((node) => isCanvasVisibleNode(node))).toBe(true);
    expect(BEHAVIOR_PALETTE.map((item) => item.label)).toEqual(["상황", "행동", "판단"]);
  });

  it("renders guard Situation→Decision→Action flow with Korean condition sentences", () => {
    const graph = createGuardBehaviorGraph();
    const visible = visibleBehaviorNodes(graph);
    expect(visible.map((node) => node.name)).toEqual(
      expect.arrayContaining(["순찰", "경계", "행동 판단", "공격", "지원요청", "후퇴"]),
    );
    expect(visible.every((node) => !["entry", "any", "exit"].includes(node.kind))).toBe(true);

    const discover = graph.edges.find((edge) => edge.source.endsWith("patrol") || edge.id === "guard-e1")!;
    expect(summarizeTransition(discover)).toBe("플레이어 발견");

    // Decision → Candidate Action: candidate link (no IF/ELSE flow-condition label)
    const toAttack = graph.edges.find((edge) => edge.id === "guard-e3")!;
    expect(isDecisionCandidateEdge(graph, toAttack)).toBe(true);
    expect(summarizeTransition(toAttack)).toBe("항상");
    expect(toAttack.conditions ?? []).toHaveLength(0);

    // Situation → Situation keeps readable condition sentence
    expect(summarizeCondition({ id: "demo", key: "플레이어 거리", operator: "<", value: "5m" })).toBe("플레이어 거리 작음 5m");

    const decide = graph.nodes.find((node) => node.name === "행동 판단")!;
    expect(decide.domain?.entityKind).toBe("decision");
    expect(decide.domain?.candidateActionIds?.length).toBe(3);
    expect(decide.domain?.candidates?.length).toBe(3);
    expect(decide.domain?.candidates?.[0]?.hardRequirements.length).toBeGreaterThan(0);
    expect(decide.domain?.candidates?.[0]?.considerations[0]?.evalStyle).toBe("closer_better");

    const attack = graph.nodes.find((node) => node.name === "공격")!;
    expect(attack.domain?.entityKind).toBe("action");
    expect(attack.domain?.intent).toMatch(/타격/);
    expect(attack.domain?.interruptible).toBe(true);
  });

  it("sample set leads with guard behavior and keeps compatibility graphs", () => {
    const set = createSamplePatternSet();
    expect(set.graphs[0]?.name).toBe("경비 행동");
    expect(set.graphs.length).toBeGreaterThanOrEqual(4);
    expect(set.blackboard.some((entry) => entry.key === "플레이어 거리")).toBe(true);
  });
});
