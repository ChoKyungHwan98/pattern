import { describe, expect, it } from "vitest";
import type { BlackboardEntry, GraphEdge } from "./model";
import { isTransitionEligible, summarizeTransition } from "./transitionSemantics";

const blackboard: BlackboardEntry[] = [
  { key: "DistanceToTarget", type: "Float", defaultValue: "0", liveValue: "3.2", source: "test" },
  { key: "HasLineOfSight", type: "Bool", defaultValue: "false", liveValue: "true", source: "test" },
];

describe("transition semantics", () => {
  it("블랙보드 조건을 AND로 평가한다", () => {
    const edge: GraphEdge = {
      id: "edge",
      source: "idle",
      target: "attack",
      triggerType: "condition",
      conditionMode: "all",
      conditions: [
        { id: "c1", key: "DistanceToTarget", operator: "<=", value: "3.5" },
        { id: "c2", key: "HasLineOfSight", operator: "==", value: "true" },
      ],
    };
    expect(isTransitionEligible(edge, blackboard)).toBe(true);
    expect(summarizeTransition(edge)).toBe("DistanceToTarget 작거나 같음 3.5 그리고 HasLineOfSight 같음 true");
  });

  it("이벤트 이름이 일치할 때만 이벤트 전환을 실행한다", () => {
    const edge: GraphEdge = { id: "edge", source: "idle", target: "hit", triggerType: "event", eventName: "Enemy.Hit" };
    expect(isTransitionEligible(edge, blackboard, { eventName: "Enemy.Hit" })).toBe(true);
    expect(isTransitionEligible(edge, blackboard, { eventName: "Enemy.SeePlayer" })).toBe(false);
  });
});
