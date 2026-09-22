import { describe, expect, it } from "vitest";
import { sampleProject } from "./sampleProject";
import { validateGraph } from "./graphValidation";

describe("graph validation", () => {
  it("accepts the bundled FSM, HFSM, and Behavior Tree examples", () => {
    Object.values(sampleProject.graphs).forEach((graph) => {
      expect(validateGraph(graph)).toEqual([]);
    });
  });

  it("reports broken transitions", () => {
    const graph = structuredClone(sampleProject.graphs.fsm);
    graph.edges[0].target = "missing-state";
    expect(validateGraph(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `broken-edge:${graph.edges[0].id}` }),
      ]),
    );
  });

  it("rejects cycles in a Behavior Tree", () => {
    const graph = structuredClone(sampleProject.graphs.bt);
    graph.edges.push({ id: "cycle", source: "bt-chase", target: "bt-root" });
    expect(validateGraph(graph)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "bt-cycle" })]),
    );
  });

  it("한 상태에서 무조건 전환이 여러 개면 오류로 보고한다", () => {
    const graph = structuredClone(sampleProject.graphs.fsm);
    graph.edges = [
      { id: "always-1", source: graph.initialNodeId!, target: "fsm-chase", triggerType: "always" },
      { id: "always-2", source: graph.initialNodeId!, target: "fsm-defend", triggerType: "always" },
    ];
    expect(validateGraph(graph)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: `ambiguous-always:${graph.initialNodeId}` })]),
    );
  });
});
