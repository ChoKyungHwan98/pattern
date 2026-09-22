import { describe, expect, it } from "vitest";
import { createSamplePatternSet } from "./patternLibrary";
import { createPatternIr } from "./patternIr";

describe("Pattern IR", () => {
  it("패턴 세트와 엔진 중립 전환 정보를 내보낸다", () => {
    const document = createPatternIr(createSamplePatternSet());
    expect(document.schema).toBe("game-design-studio.pattern-ir");
    expect(document.set.graphs).toHaveLength(3);
    expect(document.set.graphs[0].edges[0].trigger.type).toBe("event");
    expect(document.set.blackboard.length).toBeGreaterThan(0);
  });
});
