import { describe, expect, it } from "vitest";
import { createSamplePatternSet } from "./patternLibrary";
import { createDiagnosticsReport } from "./diagnostics";

describe("portfolio diagnostics", () => {
  it("그래프 복잡도와 Unity/Unreal 준비 상태를 보고한다", () => {
    const report = createDiagnosticsReport(createSamplePatternSet());
    expect(report.summary.stateMachines).toBe(3);
    expect(report.summary.behaviorTrees).toBe(1);
    expect(report.graphs.some((graph) => graph.hierarchyDepth > 1)).toBe(true);
    expect(report.engineReadiness).toEqual({ unity: true, unreal: true });
  });
});
