import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../domain/defaultProject";
import type { FsmGraph } from "../domain/project";
import { FsmRuntime } from "./FsmRuntime";

const createRuntime = () => {
  const document = createDefaultProject();
  const graph = document.behaviorGraphs.find(
    (candidate): candidate is FsmGraph => candidate.kind === "fsm",
  );
  if (!graph) throw new Error("기본 FSM이 없습니다.");
  return { document, graph, runtime: new FsmRuntime(document, graph) };
};

describe("deterministic FSM runtime", () => {
  it("changes its result immediately when authored conditions change", () => {
    const { graph, runtime } = createRuntime();
    runtime.step();
    const chase = graph.states.find((state) => state.name === "추적");
    expect(runtime.getSnapshot().activeStateId).toBe(chase?.id);

    runtime.setSensor("target.distance", 2);
    runtime.step();
    const attack = graph.states.find((state) => state.name === "공격");
    expect(runtime.getSnapshot().activeStateId).toBe(attack?.id);
  });

  it("chooses the highest-priority valid transition", () => {
    const { graph, runtime } = createRuntime();
    runtime.step();
    runtime.setSensor("target.distance", 2);
    runtime.setSensor("target.action", "검 공격");
    runtime.step();
    const defend = graph.states.find((state) => state.name === "방어");
    expect(runtime.getSnapshot().activeStateId).toBe(defend?.id);
  });

  it("produces the same hash across 100 runs with the same input log", () => {
    const { document, graph } = createRuntime();
    const hashes = Array.from({ length: 100 }, () => {
      const runtime = new FsmRuntime(document, graph);
      const states: Array<string | undefined> = [];
      for (let tick = 0; tick < 180; tick += 1) {
        if (tick === 20) runtime.setSensor("target.distance", 2);
        if (tick === 80) runtime.setSensor("target.action", "검 공격");
        states.push(runtime.step().activeStateId);
      }
      return JSON.stringify(states);
    });
    expect(new Set(hashes).size).toBe(1);
  });
});
