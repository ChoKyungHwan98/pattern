import { describe, expect, it } from "vitest";
import {
  CONTEXT_KEY_DISPLAY_NAMES,
  contextKeyAdvancedLabel,
  contextKeyDisplayName,
  formatContextFact,
  formatContextState,
} from "./contextLabels";

describe("PR7 context key display names", () => {
  it("maps stable keys to planner-facing Korean labels", () => {
    expect(contextKeyDisplayName("HasTarget")).toBe("대상 발견됨");
    expect(contextKeyDisplayName("InAttackRange")).toBe("공격 범위 안");
    expect(contextKeyDisplayName("Approaching")).toBe("접근 중");
    expect(contextKeyDisplayName("Dashed")).toBe("대시 완료");
    expect(Object.keys(CONTEXT_KEY_DISPLAY_NAMES).length).toBeGreaterThan(3);
  });

  it("formats facts with display names while unknown keys stay as-is", () => {
    expect(formatContextFact("HasTarget", true)).toBe("대상 발견됨=true");
    expect(formatContextFact("CustomFlag", false)).toBe("CustomFlag=false");
    expect(formatContextState({ HasTarget: true, Approaching: false })).toContain("대상 발견됨=true");
    expect(formatContextState({ HasTarget: true, Approaching: false })).toContain("접근 중=false");
    expect(contextKeyAdvancedLabel("HasTarget")).toBe("대상 발견됨 (HasTarget)");
    expect(contextKeyAdvancedLabel("플레이어 거리")).toBe("플레이어 거리");
  });
});