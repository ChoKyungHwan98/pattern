import { describe, expect, it } from "vitest";
import { getGraph } from "../editor/sampleProject";
import { createPatternRuntime } from "./createPatternRuntime";

describe("pattern runtime adapters", () => {
  it("XState로 FSM 전환을 실행한다", () => {
    const runtime = createPatternRuntime(structuredClone(getGraph("fsm")));
    expect(runtime.getSnapshot().activeNodeId).toBe("fsm-idle");
    expect(runtime.step().activeNodeId).toBe("fsm-chase");
  });

  it("XState로 HFSM의 자식 상태에 진입한다", () => {
    const runtime = createPatternRuntime(structuredClone(getGraph("hfsm")));
    expect(runtime.step().activeNodeId).toBe("hfsm-approach");
  });

  it("Mistreevous로 BT 노드 상태를 추적한다", () => {
    const runtime = createPatternRuntime(structuredClone(getGraph("bt")));
    const snapshot = runtime.step();
    expect(snapshot.engine).toBe("Mistreevous");
    expect(snapshot.activeNodeId).toBe("bt-guard");
    expect(snapshot.nodeStates["bt-guard"]).toBe("running");
  });

  it("계층 활성 경로·커버리지·결정적 재생을 기록한다", () => {
    const runtime = createPatternRuntime(structuredClone(getGraph("hfsm")));
    const first = runtime.step();
    expect(first.activeNodeId).toBe("hfsm-approach");
    expect(first.activePath).toContain("group-engage:owner");
    expect(first.coverage["hfsm-approach"]).toBeGreaterThan(0);
    runtime.step();
    const rewound = runtime.seek(1);
    expect(rewound.tick).toBe(1);
    expect(rewound.activeNodeId).toBe("hfsm-approach");
    runtime.dispose();
  });
});
