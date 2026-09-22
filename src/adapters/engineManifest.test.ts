import { describe, expect, it } from "vitest";
import { createSamplePatternSet } from "../editor/patternLibrary";
import { createEngineImportManifest } from "./engineManifest";

describe("engine import manifests", () => {
  it("UnityHFSM과 Unity Behavior 자산 종류로 매핑한다", () => {
    const manifest = createEngineImportManifest(createSamplePatternSet(), "unity");
    expect(manifest.target.requiredModules).toContain("com.inspiaaa.unityhfsm");
    expect(manifest.patternSet.graphs.find((graph) => graph.sourceMode === "state-machine")?.assetKind).toBe("UnityHFSM");
    expect(manifest.patternSet.graphs.find((graph) => graph.sourceMode === "bt")?.assetKind).toBe("UnityBehaviorGraph");
  });

  it("Unreal StateTree와 Behavior Tree 자산 종류로 매핑한다", () => {
    const manifest = createEngineImportManifest(createSamplePatternSet(), "unreal");
    expect(manifest.target.requiredModules).toContain("StateTree");
    expect(manifest.patternSet.graphs.find((graph) => graph.sourceMode === "state-machine")?.assetKind).toBe("StateTree");
    expect(manifest.patternSet.graphs.find((graph) => graph.sourceMode === "bt")?.assetKind).toBe("BehaviorTree");
  });
});
