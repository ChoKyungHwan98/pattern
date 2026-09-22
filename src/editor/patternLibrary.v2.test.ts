import { describe, expect, it } from "vitest";
import { createGraph, duplicateGraphDefinition, migratePatternLibrary } from "./patternLibrary";
import { createChildMachine } from "./stateMachine";

describe("Pattern Library v2", () => {
  it("v1 FSM/HFSM을 상태 머신 문서와 실제 스코프로 무손실 변환한다", () => {
    const migrated = migratePatternLibrary({
      schemaVersion: 1,
      sets: [{
        id: "set", name: "Legacy", createdAt: "2026-01-01", updatedAt: "2026-01-01", blackboard: [],
        graphs: [{
          id: "legacy-hfsm", mode: "hfsm", name: "Boss", initialNodeId: "idle",
          nodes: [{ id: "idle", name: "Idle", kind: "state", position: { x: 0, y: 0 } }, { id: "attack", name: "Attack", kind: "state", parentId: "combat", position: { x: 200, y: 0 } }],
          edges: [{ id: "edge", source: "idle", target: "attack" }],
          groups: [{ id: "combat", name: "Combat", position: { x: 100, y: 100 }, width: 400, height: 300, initialNodeId: "attack" }],
        }],
      }],
    }, "workspace");
    const graph = migrated.sets[0].graphs[0];
    expect(migrated.schemaVersion).toBe(2);
    expect(graph.mode).toBe("state-machine");
    expect(graph.scopes.some((scope) => scope.id === "combat")).toBe(true);
    expect(graph.nodes.find((node) => node.id === "attack")?.scopeId).toBe("combat");
    expect(graph.nodes.some((node) => node.kind === "submachine" && node.childScopeId === "combat")).toBe(true);
    expect(graph.edges[0]).toMatchObject({ id: "edge", source: "idle", target: "attack" });
  });

  it("하위 머신을 무제한 중첩하고 그래프 복제 시 모든 참조 ID를 다시 만든다", () => {
    const root = createGraph("state-machine", "Boss");
    const first = createChildMachine(root, root.rootScopeId!, "Combat");
    const second = createChildMachine(first.graph, first.scopeId, "Heavy Attack");
    const copy = duplicateGraphDefinition(second.graph);
    expect(second.graph.scopes).toHaveLength(3);
    expect(new Set(copy.nodes.map((node) => node.id)).size).toBe(copy.nodes.length);
    expect(copy.id).not.toBe(second.graph.id);
    expect(copy.scopes.every((scope) => scope.id !== second.graph.scopes.find((item) => item.name === scope.name)?.id)).toBe(true);
  });
});
