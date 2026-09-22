import { describe, expect, it } from "vitest";
import { sampleProject } from "./sampleProject";

describe("sample editor project", () => {
  it("keeps graph references valid in every authoring mode", () => {
    Object.values(sampleProject.graphs).forEach((graph) => {
      const nodeIds = new Set(graph.nodes.map((node) => node.id));
      graph.edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
      graph.nodes.forEach((node) => {
        if (node.scopeId && graph.mode === "state-machine") {
          expect(graph.scopes.some((scope) => scope.id === node.scopeId)).toBe(true);
        }
      });
    });
  });

  it("provides flat and nested State Machine examples plus a Behavior Tree", () => {
    expect(sampleProject.graphs.fsm.nodes.length).toBeGreaterThan(3);
    expect(sampleProject.graphs.hfsm.scopes.length).toBeGreaterThan(1);
    expect(sampleProject.graphs.bt.nodes.some((node) => node.kind === "selector")).toBe(
      true,
    );
  });
});
