import type {
  ConditionExpr,
  FsmGraph,
  ProjectDocument,
  SensorKey,
  Transition,
} from "../domain/project";

export type SensorValues = Record<SensorKey, boolean | number | string>;

export interface RuntimeTrace {
  tick: number;
  stateId: string;
  transitionId?: string;
  reason: string;
}

export interface RuntimeSnapshot {
  tick: number;
  activeStateId?: string;
  stateEnteredTick: number;
  sensors: SensorValues;
  traces: RuntimeTrace[];
}

const defaultSensors: SensorValues = {
  "target.visible": true,
  "target.distance": 6,
  "target.action": "대기",
  "self.healthRatio": 1,
  "self.cooldownReady": false,
  "self.wasHit": false,
  "self.isGuarding": false,
};

function compare(
  actual: boolean | number | string,
  operator: Extract<ConditionExpr, { kind: "compare" }>["operator"],
  expected: boolean | number | string,
): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
  }
}

export function evaluateCondition(
  condition: ConditionExpr,
  sensors: SensorValues,
): boolean {
  switch (condition.kind) {
    case "compare":
      return compare(sensors[condition.sensor], condition.operator, condition.value);
    case "all":
      return condition.children.every((child) => evaluateCondition(child, sensors));
    case "any":
      return condition.children.some((child) => evaluateCondition(child, sensors));
    case "not":
      return !evaluateCondition(condition.child, sensors);
  }
}

function pickTransition(
  graph: FsmGraph,
  stateId: string,
  sensors: SensorValues,
): Transition | undefined {
  return graph.transitions
    .filter(
      (transition) =>
        transition.sourceStateId === stateId &&
        evaluateCondition(transition.conditions, sensors),
    )
    .sort(
      (left, right) =>
        right.priority - left.priority || left.id.localeCompare(right.id),
    )[0];
}

export class FsmRuntime {
  private snapshot: RuntimeSnapshot;

  constructor(
    private readonly document: ProjectDocument,
    private readonly graph: FsmGraph,
    sensors: Partial<SensorValues> = {},
  ) {
    this.snapshot = {
      tick: 0,
      activeStateId: graph.initialStateId,
      stateEnteredTick: 0,
      sensors: { ...defaultSensors, ...sensors },
      traces: graph.initialStateId
        ? [
            {
              tick: 0,
              stateId: graph.initialStateId,
              reason: "시작 상태 진입",
            },
          ]
        : [],
    };
  }

  setSensor(key: SensorKey, value: boolean | number | string) {
    this.snapshot.sensors = { ...this.snapshot.sensors, [key]: value };
  }

  step(): RuntimeSnapshot {
    this.snapshot.tick += 1;
    const state = this.graph.states.find(
      (candidate) => candidate.id === this.snapshot.activeStateId,
    );
    const actionId = state?.entryActionIds[0];
    const action = this.document.actions.find((candidate) => candidate.id === actionId);
    const elapsed = this.snapshot.tick - this.snapshot.stateEnteredTick;
    this.snapshot.sensors["self.cooldownReady"] = action
      ? elapsed >= action.durationTicks
      : elapsed >= 1;

    if (this.snapshot.activeStateId) {
      const transition = pickTransition(
        this.graph,
        this.snapshot.activeStateId,
        this.snapshot.sensors,
      );
      if (transition) {
        this.snapshot.activeStateId = transition.targetStateId;
        this.snapshot.stateEnteredTick = this.snapshot.tick;
        this.snapshot.sensors["self.cooldownReady"] = false;
        this.snapshot.traces = [
          ...this.snapshot.traces.slice(-199),
          {
            tick: this.snapshot.tick,
            stateId: transition.targetStateId,
            transitionId: transition.id,
            reason: "조건 충족 및 우선순위 선택",
          },
        ];
      }
    }
    return this.getSnapshot();
  }

  getSnapshot(): RuntimeSnapshot {
    return {
      ...this.snapshot,
      sensors: { ...this.snapshot.sensors },
      traces: [...this.snapshot.traces],
    };
  }
}
