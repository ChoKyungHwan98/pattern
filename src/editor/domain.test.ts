import { describe, expect, it } from "vitest";
import {
  PATTERN_DEFINITION_SCHEMA_VERSION,
  buildPatternDefinition,
  createConsideration,
  createDecisionCandidate,
  createDomainGraphNode,
  createHardRequirement,
  formatConsiderationBrief,
  formatHardRequirementBrief,
  normalizeDecisionCandidates,
  resolveDomainEntityKind,
  syncPatternDefinitions,
  withInternalScoring,
} from "./domain";
import { createGraph, createPatternSet, createSamplePatternSet, normalizeGraph } from "./patternLibrary";

describe("Pattern Designer PR2 domain model", () => {
  it("creates State/Action/Decision nodes with domain payload and mapped GraphNodeKind", () => {
    const state = createDomainGraphNode({
      mode: "state-machine",
      entityKind: "state",
      index: 1,
      scopeId: "root",
      position: { x: 0, y: 0 },
    });
    const actionSm = createDomainGraphNode({
      mode: "state-machine",
      entityKind: "action",
      index: 2,
      scopeId: "root",
      position: { x: 10, y: 0 },
    });
    const decisionBt = createDomainGraphNode({
      mode: "bt",
      entityKind: "decision",
      index: 3,
      position: { x: 20, y: 0 },
    });
    const actionBt = createDomainGraphNode({
      mode: "bt",
      entityKind: "action",
      index: 4,
      position: { x: 30, y: 0 },
    });

    expect(state.kind).toBe("state");
    expect(state.domain?.entityKind).toBe("state");
    expect(actionSm.kind).toBe("state");
    expect(actionSm.domain?.entityKind).toBe("action");
    expect(decisionBt.kind).toBe("selector");
    expect(decisionBt.domain?.decisionKind).toBe("SELECTOR");
    expect(actionBt.kind).toBe("task");
    expect(resolveDomainEntityKind(actionBt)).toBe("action");
  });

  it("builds PatternDefinition from graph + blackboard with schemaVersion", () => {
    const graph = createGraph("state-machine", "Boss");
    const withDecision = {
      ...graph,
      initialNodeId: "state-1",
      scopes: graph.scopes.map((scope) => scope.id === graph.rootScopeId ? { ...scope, initialNodeId: "state-1" } : scope),
      nodes: [
        ...graph.nodes,
        createDomainGraphNode({
          mode: "state-machine",
          entityKind: "state",
          index: 1,
          scopeId: graph.rootScopeId,
          position: { x: 40, y: 100 },
          id: "state-1",
        }),
        createDomainGraphNode({
          mode: "state-machine",
          entityKind: "decision",
          index: 9,
          scopeId: graph.rootScopeId,
          position: { x: 100, y: 100 },
          id: "decision-1",
        }),
        createDomainGraphNode({
          mode: "state-machine",
          entityKind: "action",
          index: 10,
          scopeId: graph.rootScopeId,
          position: { x: 200, y: 100 },
          id: "action-1",
        }),
      ],
    };
    const patched = {
      ...withDecision,
      nodes: withDecision.nodes.map((node) =>
        node.id === "decision-1"
          ? {
              ...node,
              domain: {
                entityKind: "decision" as const,
                decisionKind: "UTILITY" as const,
                conditionExpression: "hp < 0.5",
                weights: { a: 0.7, b: 0.3 },
                timing: { durationMs: 500 },
                candidates: [
                  createDecisionCandidate({
                    actionNodeId: "action-1",
                    hardRequirements: [createHardRequirement({ variableKey: "CooldownReady", operator: "is_true" })],
                    considerations: [
                      withInternalScoring(createConsideration({
                        variableKey: "플레이어 거리",
                        evalStyle: "closer_better",
                        rangeLabel: "0~10m",
                        influence: "high",
                      })),
                    ],
                  }),
                ],
              },
            }
          : node,
      ),
    };

    const definition = buildPatternDefinition(patched, [
      { key: "hp", type: "Float", defaultValue: "1", liveValue: "1", source: "test" },
    ]);

    expect(definition.schemaVersion).toBe(PATTERN_DEFINITION_SCHEMA_VERSION);
    expect(definition.graphId).toBe(patched.id);
    expect(definition.states.length).toBeGreaterThan(0);
    expect(definition.actions.some((item) => item.graphNodeId === "action-1")).toBe(true);
    expect(definition.decisions[0]).toMatchObject({
      kind: "UTILITY",
      conditionExpression: "hp < 0.5",
      weights: { a: 0.7, b: 0.3 },
    });
    expect(definition.decisions[0].candidates).toHaveLength(1);
    expect(definition.decisions[0].candidates[0]?.actionNodeId).toBe("action-1");
    expect(definition.decisions[0].candidateActionIds).toEqual(["action-1"]);
    expect(definition.variables[0]?.key).toBe("hp");
    expect(definition.goap?.enabled).toBe(false);
  });

  it("dual-writes patternDefinitions on PatternSet without breaking normalize / Cinder sample", () => {
    const sample = createSamplePatternSet();
    const synced = syncPatternDefinitions(sample);
    expect(synced.patternDefinitions?.length).toBe(sample.graphs.length);
    expect(synced.patternDefinitions?.every((item) => item.schemaVersion === 1)).toBe(true);

    const set = createPatternSet("PR2");
    const graph = createGraph("bt", "Tree");
    const withDomain = {
      ...set,
      graphs: [graph],
      blackboard: [{ key: "ready", type: "Bool" as const, defaultValue: "true", liveValue: "true", source: "test" }],
    };
    const next = syncPatternDefinitions(withDomain);
    expect(next.patternDefinitions?.[0]?.variables[0]?.key).toBe("ready");

    const roundTrip = normalizeGraph({
      ...graph,
      nodes: [
        ...graph.nodes,
        createDomainGraphNode({
          mode: "bt",
          entityKind: "decision",
          index: 1,
          position: { x: 1, y: 1 },
          id: "d1",
        }),
      ],
    });
    expect(roundTrip.nodes.find((node) => node.id === "d1")?.domain?.entityKind).toBe("decision");
  });
});

describe("Pattern Designer PR4 Decision System", () => {
  it("formats planner-facing consideration and hard-requirement sentences without math", () => {
    const consideration = withInternalScoring(createConsideration({
      variableKey: "플레이어 거리",
      evalStyle: "closer_better",
      range: { min: 0, max: 10, unit: "m" },
      influence: "high",
    }));
    expect(formatConsiderationBrief(consideration)).toBe("플레이어 거리 → 0~10m · 가까울수록 · 영향도 높음");
    expect(consideration.internalWeight).toBe(1);
    expect(consideration.internalCurve).toBe("inverse");

    expect(formatHardRequirementBrief(createHardRequirement({
      variableKey: "CooldownReady",
      operator: "is_true",
    }))).toBe("쿨다운 준비 참");
  });

  it("migrates legacy candidateActionIds into structured candidates", () => {
    const migrated = normalizeDecisionCandidates({
      candidateActionIds: ["a", "b"],
    });
    expect(migrated.map((item) => item.actionNodeId)).toEqual(["a", "b"]);
    expect(migrated.every((item) => item.hardRequirements.length === 0)).toBe(true);
  });

  it("prefers structured candidates over legacy flat ids", () => {
    const structured = normalizeDecisionCandidates({
      candidateActionIds: ["legacy"],
      candidates: [createDecisionCandidate({ actionNodeId: "fresh" })],
    });
    expect(structured).toHaveLength(1);
    expect(structured[0]?.actionNodeId).toBe("fresh");
  });
});
