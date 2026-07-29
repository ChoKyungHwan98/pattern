import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { applyProjectCommand, createState } from "./commands";
import { createDefaultProject } from "./defaultProject";

describe("typed project commands", () => {
  it("renames a state while preserving its permanent id", () => {
    const document = createDefaultProject();
    const graph = document.behaviorGraphs.find((candidate) => candidate.kind === "fsm");
    expect(graph?.kind).toBe("fsm");
    if (!graph || graph.kind !== "fsm") return;
    const stateId = graph.states[0].id;

    const next = produce(document, (draft) => {
      applyProjectCommand(draft, {
        type: "fsm/renameState",
        graphId: graph.id,
        stateId,
        name: "전투 대기",
      });
    });

    const nextGraph = next.behaviorGraphs.find((candidate) => candidate.id === graph.id);
    expect(nextGraph?.kind).toBe("fsm");
    if (!nextGraph || nextGraph.kind !== "fsm") return;
    expect(nextGraph.states[0]).toMatchObject({ id: stateId, name: "전투 대기" });
    expect(document.behaviorGraphs).not.toBe(next.behaviorGraphs);
  });

  it("deleting a state removes connected transitions and the initial reference", () => {
    const document = createDefaultProject();
    const graph = document.behaviorGraphs.find((candidate) => candidate.kind === "fsm");
    if (!graph || graph.kind !== "fsm" || !graph.initialStateId) return;
    const initialStateId = graph.initialStateId;

    const next = produce(document, (draft) => {
      applyProjectCommand(draft, {
        type: "fsm/deleteState",
        graphId: graph.id,
        stateId: initialStateId,
      });
    });
    const nextGraph = next.behaviorGraphs.find((candidate) => candidate.id === graph.id);
    if (!nextGraph || nextGraph.kind !== "fsm") return;
    expect(nextGraph.initialStateId).toBeUndefined();
    expect(
      nextGraph.transitions.some(
        (transition) =>
          transition.sourceStateId === initialStateId ||
          transition.targetStateId === initialStateId,
      ),
    ).toBe(false);
  });

  it("creates new states with UUID-backed ids", () => {
    const first = createState("상태", { x: 0, y: 0 });
    const second = createState("상태", { x: 0, y: 0 });
    expect(first.id).not.toBe(second.id);
  });
});
