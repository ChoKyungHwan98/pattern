import { describe, expect, it } from "vitest";
import { createSamplePatternSet } from "./patternLibrary";
import { patternArtifactRecord } from "./studioArtifact";

describe("pattern studio artifact", () => {
  it("publishes editable graph geometry without flattening it to an image", () => {
    const set = createSamplePatternSet();
    const record = patternArtifactRecord(set);
    expect(record.kind).toBe("pattern-set");
    expect(record.data.graphs.length).toBeGreaterThan(0);
    expect(record.data.graphs[0]?.nodes[0]?.position).toBeDefined();
    expect(record.data.graphs[0]?.edges).toBeDefined();
  });
});
