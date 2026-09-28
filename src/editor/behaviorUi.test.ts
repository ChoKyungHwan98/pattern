import { describe, expect, it } from "vitest";
import {
  BEHAVIOR_PALETTE,
  behaviorDocumentLabel,
  behaviorEntityLabel,
  canvasNodeKindName,
  createConditionGraphNode,
  decisionCanvasBrief,
  firstSelectableNodeId,
  interruptEdges,
  isCanvasVisibleNode,
  visibleBehaviorNodes,
} from "./behaviorUi";
import { createDomainGraphNode } from "./domain";
import { createGraph } from "./patternLibrary";
import { ensureScopeSystemNodes } from "./stateMachine";

describe("Pattern Designer PR3 Behavior Canvas UI", () => {
  it("palette presents Situation/Action/Decision in Korean without FSM/HFSM/BT", () => {
    expect(BEHAVIOR_PALETTE.map((item) => item.label)).toEqual([
      "상황",
      "행동",
      "판단",
    ]);
    const blob = BEHAVIOR_PALETTE.map((item) => `${item.label} ${item.shortDescription}`).join("\n");
    expect(blob).toMatch(/상태인지|무엇을 하는지|고르는 지점/);
    expect(blob.toLowerCase()).not.toMatch(/fsm|hfsm|\bbt\b|xstate/);
    expect(behaviorDocumentLabel("state-machine")).toBe("행동 캔버스");
    expect(behaviorDocumentLabel("bt")).toBe("행동 캔버스");
    expect(behaviorEntityLabel("state")).toBe("상황");
    expect(behaviorEntityLabel("decision")).toBe("판단");
  });

  it("hides Entry/Any/Exit from default canvas visibility while keeping them in GraphDefinition", () => {
    let graph = createGraph("state-machine", "Patrol");
    graph = ensureScopeSystemNodes(graph, graph.rootScopeId!);
    const entry = graph.nodes.find((node) => node.kind === "entry");
    const any = graph.nodes.find((node) => node.kind === "any");
    const exit = graph.nodes.find((node) => node.kind === "exit");
    expect(entry && any && exit).toBeTruthy();
    expect(isCanvasVisibleNode(entry!)).toBe(false);
    expect(isCanvasVisibleNode(any!)).toBe(false);
    expect(isCanvasVisibleNode(exit!)).toBe(false);

    const situation = createDomainGraphNode({
      mode: "state-machine",
      entityKind: "state",
      index: 1,
      scopeId: graph.rootScopeId,
      position: { x: 200, y: 200 },
      id: "sit-1",
    });
    graph = {
      ...graph,
      nodes: [...graph.nodes, situation],
      initialNodeId: situation.id,
      scopes: graph.scopes.map((scope) =>
        scope.id === graph.rootScopeId ? { ...scope, initialNodeId: situation.id } : scope,
      ),
      edges: [
        ...graph.edges,
        {
          id: "interrupt-1",
          source: any!.id,
          target: situation.id,
          label: "피격",
        },
      ],
    };

    const visible = visibleBehaviorNodes(graph, graph.rootScopeId);
    expect(visible.map((node) => node.id)).toContain("sit-1");
    expect(visible.every((node) => node.kind !== "entry" && node.kind !== "any" && node.kind !== "exit")).toBe(true);
    expect(firstSelectableNodeId(graph)).toBe("sit-1");
    expect(interruptEdges(graph, graph.rootScopeId)).toHaveLength(1);
    expect(canvasNodeKindName(situation)).toBe("상황");
  });

  it("creates condition nodes for the Behavior palette", () => {
    const node = createConditionGraphNode({
      mode: "state-machine",
      index: 3,
      scopeId: "root",
      position: { x: 10, y: 10 },
    });
    expect(node.kind).toBe("condition");
    expect(node.subtitle).toBe("조건");
    expect(node.name).toContain("조건");
  });
  it("decision canvas brief lists candidates without live scores", () => {
    const brief = decisionCanvasBrief({
      id: "d1",
      name: "행동 판단",
      kind: "state",
      position: { x: 0, y: 0 },
      domain: {
        entityKind: "decision",
        decisionKind: "UTILITY",
        candidates: [
          {
            id: "c1",
            actionNodeId: "a1",
            hardRequirements: [],
            considerations: [{
              id: "k1",
              variableKey: "플레이어 거리",
              evalStyle: "closer_better",
              range: { min: 0, max: 10, unit: "m" },
              influence: "high",
            }],
          },
        ],
      },
    }, (id) => (id === "a1" ? "공격" : id));
    expect(brief?.headline).toContain("후보 1");
    expect(brief?.lines[0]).toContain("공격");
    expect(brief?.lines[0]).toContain("가까울수록");
  });
});
