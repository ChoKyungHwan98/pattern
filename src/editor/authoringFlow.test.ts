import { describe, expect, it } from "vitest";
import {
  ANYWHERE_INTERRUPT_LABEL,
  classifyAuthoringLink,
  createContextVariableEntry,
  isBehaviorCanvasEmpty,
  suggestContextKeyFromDisplayName,
} from "./authoringFlow";
import { createDomainGraphNode } from "./domain";
import { createGraph } from "./patternLibrary";

describe("PR8 authoringFlow helpers", () => {
  it("starts empty of visible situations", () => {
    const graph = createGraph("state-machine", "상점 NPC");
    expect(isBehaviorCanvasEmpty(graph)).toBe(true);
  });

  it("allows situation→situation, situation→decision, decision→action", () => {
    let graph = createGraph("state-machine", "상점");
    const wait = createDomainGraphNode({ mode: "state-machine", entityKind: "state", index: 1, scopeId: graph.rootScopeId, position: { x: 0, y: 0 }, id: "wait" });
    const greet = createDomainGraphNode({ mode: "state-machine", entityKind: "state", index: 2, scopeId: graph.rootScopeId, position: { x: 100, y: 0 }, id: "greet" });
    const decide = createDomainGraphNode({ mode: "state-machine", entityKind: "decision", index: 3, scopeId: graph.rootScopeId, position: { x: 200, y: 0 }, id: "decide" });
    const act = createDomainGraphNode({ mode: "state-machine", entityKind: "action", index: 4, scopeId: graph.rootScopeId, position: { x: 300, y: 0 }, id: "act" });
    wait.name = "대기";
    greet.name = "인사";
    decide.name = "응대 판단";
    act.name = "인사하기";
    graph = { ...graph, nodes: [...graph.nodes, wait, greet, decide, act] };

    expect(classifyAuthoringLink(graph, "wait", "greet").ok).toBe(true);
    expect(classifyAuthoringLink(graph, "wait", "greet").promptCondition).toBe(true);
    expect(classifyAuthoringLink(graph, "wait", "decide").kind).toBe("situation-decision");
    expect(classifyAuthoringLink(graph, "decide", "act").kind).toBe("decision-action");
    expect(classifyAuthoringLink(graph, "act", "wait").ok).toBe(false);
    expect(classifyAuthoringLink(graph, "decide", "wait").message).toMatch(/행동/);
  });

  it("classifies any→situation as interrupt without exposing Any State copy", () => {
    const graph = createGraph("state-machine", "상점");
    const any = graph.nodes.find((node) => node.kind === "any")!;
    const flee = createDomainGraphNode({
      mode: "state-machine",
      entityKind: "state",
      index: 1,
      scopeId: graph.rootScopeId,
      position: { x: 0, y: 0 },
      id: "flee",
    });
    flee.name = "도망";
    const next = { ...graph, nodes: [...graph.nodes, flee] };
    const result = classifyAuthoringLink(next, any.id, "flee");
    expect(result.ok).toBe(true);
    expect(result.kind).toBe("interrupt");
    expect(result.message).toContain(ANYWHERE_INTERRUPT_LABEL);
    expect(result.message.toLowerCase()).not.toMatch(/any state|fsm/);
  });

  it("creates context vars with displayName first", () => {
    const entry = createContextVariableEntry("가까움");
    expect(entry.displayName).toBe("가까움");
    expect(entry.key).toBe("가까움");
    expect(entry.type).toBe("Bool");
    expect(suggestContextKeyFromDisplayName("Player Nearby")).toBe("Player_Nearby");
  });
});
