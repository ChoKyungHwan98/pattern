import { describe, expect, it, vi } from "vitest";
import type { GraphDefinition } from "./model";
import { deleteGraphEdge, deleteGraphNode, duplicateGraphNode } from "./graphCommands";

const graph: GraphDefinition = {
  id: "graph",
  mode: "state-machine",
  name: "테스트 FSM",
  initialNodeId: "idle",
  nodes: [
    { id: "idle", name: "Idle", kind: "state", scopeId: "root", position: { x: 0, y: 0 } },
    { id: "attack", name: "Attack", kind: "state", scopeId: "root", position: { x: 100, y: 80 } },
  ],
  edges: [{ id: "idle-attack", source: "idle", target: "attack" }],
  groups: [],
  scopes: [{ id: "root", name: "Root", initialNodeId: "idle", history: "none", regionMode: "exclusive" }],
  rootScopeId: "root",
};

describe("graph commands", () => {
  it("노드를 삭제하면 연결 전환을 함께 제거하고 시작 상태를 안전하게 넘긴다", () => {
    const result = deleteGraphNode(graph, "idle");

    expect(result.graph.nodes.map((node) => node.id)).toEqual(["attack"]);
    expect(result.graph.edges).toHaveLength(0);
    expect(result.graph.initialNodeId).toBe("attack");
    expect(result.selectedNodeId).toBe("attack");
  });

  it("전환만 삭제한다", () => {
    expect(deleteGraphEdge(graph, "idle-attack").edges).toHaveLength(0);
    expect(deleteGraphEdge(graph, "missing")).toBe(graph);
  });

  it("노드를 복제하되 연결은 복제하지 않는다", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
    const result = duplicateGraphNode(graph, graph.nodes[0]);

    expect(result.graph.nodes).toHaveLength(3);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.nodes[2]).toMatchObject({
      id: "state-machine-node-00000000-0000-4000-8000-000000000000",
      name: "Idle 복사본",
      position: { x: 32, y: 32 },
    });
  });
});
