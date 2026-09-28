import type { AssetRecord, BlackboardEntry, GraphDefinition, GraphGroup, GraphNode, TraceEvent } from "./model";
import { ensureAllScopeSystemNodes } from "./stateMachine";

type LegacySampleGraph = {
  id: string;
  mode: "fsm" | "hfsm" | "bt";
  name: string;
  initialNodeId?: string;
  rootNodeId?: string;
  nodes: GraphNode[];
  edges: GraphDefinition["edges"];
  groups: GraphGroup[];
};

const legacyFsm: LegacySampleGraph = {
  id: "graph-boss-fsm",
  mode: "fsm",
  name: "Cinder Knight FSM",
  initialNodeId: "fsm-idle",
  groups: [],
  nodes: [
    {
      id: "fsm-idle",
      name: "Idle",
      kind: "state",
      position: { x: 90, y: 245 },
      subtitle: "Start State",
      action: "Idle_Combat",
      description: "대상을 발견하기 전 전투 대기 상태입니다.",
    },
    {
      id: "fsm-chase",
      name: "Chase",
      kind: "state",
      position: { x: 350, y: 130 },
      subtitle: "Locomotion",
      action: "Move_To_Target",
      description: "공격 거리까지 목표를 추적합니다.",
    },
    {
      id: "fsm-attack",
      name: "Attack",
      kind: "state",
      position: { x: 650, y: 130 },
      subtitle: "Combat",
      action: "Select_Attack",
      description: "거리와 쿨다운을 기반으로 공격 행동을 선택합니다.",
    },
    {
      id: "fsm-defend",
      name: "Defend",
      kind: "state",
      position: { x: 350, y: 370 },
      subtitle: "Reaction",
      action: "Guard",
      description: "위협 방향을 향해 방어합니다.",
    },
    {
      id: "fsm-recover",
      name: "Recover",
      kind: "state",
      position: { x: 900, y: 245 },
      subtitle: "Cooldown",
      action: "Recover_Short",
      description: "행동 종료 후 다음 판단까지의 회복 상태입니다.",
    },
  ],
  edges: [
    {
      id: "fsm-e1",
      source: "fsm-idle",
      target: "fsm-chase",
      label: "TargetVisible",
      priority: 10,
    },
    {
      id: "fsm-e2",
      source: "fsm-chase",
      target: "fsm-attack",
      label: "Distance ≤ 2.4m",
      priority: 20,
    },
    {
      id: "fsm-e3",
      source: "fsm-chase",
      target: "fsm-defend",
      label: "IncomingThreat",
      priority: 30,
      accent: "warning",
    },
    {
      id: "fsm-e4",
      source: "fsm-attack",
      target: "fsm-recover",
      label: "ActionFinished",
      priority: 10,
    },
    {
      id: "fsm-e5",
      source: "fsm-defend",
      target: "fsm-chase",
      label: "ThreatCleared",
      priority: 10,
    },
    {
      id: "fsm-e6",
      source: "fsm-recover",
      target: "fsm-chase",
      label: "CooldownReady",
      priority: 10,
    },
  ],
};

const legacyHfsm: LegacySampleGraph = {
  id: "graph-boss-hfsm",
  mode: "hfsm",
  name: "Cinder Knight Combat HFSM",
  initialNodeId: "hfsm-idle",
  groups: [
    {
      id: "group-engage",
      name: "Engagement",
      position: { x: 325, y: 70 },
      width: 330,
      height: 470,
      initialNodeId: "hfsm-approach",
      history: "shallow",
      regionMode: "exclusive",
    },
    {
      id: "group-combat",
      name: "Combat",
      position: { x: 690, y: 70 },
      width: 390,
      height: 470,
      initialNodeId: "hfsm-select",
      history: "none",
      regionMode: "exclusive",
    },
  ],
  nodes: [
    {
      id: "hfsm-any",
      name: "Any State",
      kind: "any",
      position: { x: 70, y: 125 },
      subtitle: "Global",
      description: "전역 인터럽트가 평가되는 가상 상태입니다.",
    },
    {
      id: "hfsm-idle",
      name: "Idle",
      kind: "state",
      position: { x: 70, y: 310 },
      subtitle: "Start State",
      action: "Idle_Combat",
      description: "전투 진입 전 대기 상태입니다.",
    },
    {
      id: "hfsm-approach",
      name: "Approach",
      kind: "state",
      parentId: "group-engage",
      position: { x: 395, y: 155 },
      subtitle: "Movement",
      action: "Move_To_Target",
      description: "직선 접근과 장애물 회피를 수행합니다.",
    },
    {
      id: "hfsm-circle",
      name: "Circle",
      kind: "state",
      parentId: "group-engage",
      position: { x: 395, y: 350 },
      subtitle: "Movement",
      action: "Circle_Target",
      description: "공격 각도를 확보하기 위해 목표 주위를 선회합니다.",
    },
    {
      id: "hfsm-select",
      name: "Select Attack",
      kind: "state",
      parentId: "group-combat",
      position: { x: 755, y: 135 },
      subtitle: "Decision",
      action: "Score_Attacks",
      description: "거리, 방향, 쿨다운으로 사용 가능한 공격을 평가합니다.",
      decorators: ["HasTarget", "NotStaggered"],
    },
    {
      id: "hfsm-heavy",
      name: "Heavy Slam",
      kind: "state",
      parentId: "group-combat",
      position: { x: 835, y: 285 },
      subtitle: "Montage Action",
      action: "Attack_HeavySlam",
      description: "전방 원뿔 판정을 가진 강공격 행동입니다.",
      decorators: ["Distance ≤ 3.5m", "CooldownReady"],
    },
    {
      id: "hfsm-recover",
      name: "Recover",
      kind: "state",
      parentId: "group-combat",
      position: { x: 755, y: 430 },
      subtitle: "Cooldown",
      action: "Recover_Long",
      description: "강공격 후 회전과 이동을 잠그는 후딜 상태입니다.",
    },
  ],
  edges: [
    {
      id: "hfsm-e1",
      source: "hfsm-idle",
      target: "group-engage:owner",
      label: "TargetVisible",
      priority: 10,
    },
    {
      id: "hfsm-e2",
      source: "hfsm-approach",
      target: "hfsm-circle",
      label: "NearTarget",
      priority: 10,
    },
    {
      id: "hfsm-e3",
      source: "hfsm-circle",
      target: "group-engage:exit",
      label: "AttackOpening",
      priority: 20,
    },
    {
      id: "hfsm-e3b",
      source: "group-engage:owner",
      target: "group-combat:owner",
      triggerType: "completed",
      label: "Engagement 완료",
      priority: 20,
    },
    {
      id: "hfsm-e4",
      source: "hfsm-select",
      target: "hfsm-heavy",
      label: "HeavySlam = 0.82",
      priority: 50,
      accent: "success",
    },
    {
      id: "hfsm-e5",
      source: "hfsm-heavy",
      target: "hfsm-recover",
      label: "ActionFinished",
      priority: 10,
    },
    {
      id: "hfsm-e6",
      source: "hfsm-recover",
      target: "group-combat:exit",
      label: "RecoveryFinished",
      priority: 10,
    },
    {
      id: "hfsm-e6b",
      source: "group-combat:owner",
      target: "group-engage:owner",
      triggerType: "completed",
      label: "Combat 완료",
      priority: 10,
    },
    {
      id: "hfsm-e7",
      source: "hfsm-any",
      target: "hfsm-recover",
      label: "WasInterrupted",
      triggerType: "condition",
      conditions: [{ id: "was-interrupted", key: "WasInterrupted", operator: "==", value: "true" }],
      priority: 100,
      accent: "warning",
    },
  ],
};

const legacyBt: LegacySampleGraph = {
  id: "graph-boss-bt",
  mode: "bt",
  name: "Cinder Knight Behavior Tree",
  rootNodeId: "bt-root",
  groups: [],
  nodes: [
    {
      id: "bt-root",
      name: "Combat Root",
      kind: "selector",
      position: { x: 470, y: 55 },
      subtitle: "Priority Selector",
      description: "왼쪽부터 실행 가능한 첫 분기를 선택합니다.",
    },
    {
      id: "bt-react",
      name: "React To Threat",
      kind: "sequence",
      position: { x: 170, y: 190 },
      subtitle: "Sequence",
      description: "즉각 대응이 필요한 위협을 처리합니다.",
    },
    {
      id: "bt-combat",
      name: "Combat",
      kind: "sequence",
      position: { x: 470, y: 190 },
      subtitle: "Sequence",
      description: "공격 가능 여부를 확인하고 행동을 실행합니다.",
    },
    {
      id: "bt-chase",
      name: "Chase Target",
      kind: "task",
      position: { x: 770, y: 190 },
      subtitle: "Action",
      action: "Move_To_Target",
      description: "NavMesh 경로를 따라 공격 거리까지 접근합니다.",
    },
    {
      id: "bt-threat",
      name: "Incoming Threat?",
      kind: "condition",
      position: { x: 80, y: 350 },
      subtitle: "Condition",
      description: "예측 충돌 시간이 방어 반응 범위인지 검사합니다.",
    },
    {
      id: "bt-guard",
      name: "Guard",
      kind: "task",
      position: { x: 270, y: 350 },
      subtitle: "Action",
      action: "Guard",
      description: "위협 방향을 향해 가드 행동을 실행합니다.",
    },
    {
      id: "bt-range",
      name: "In Attack Range?",
      kind: "condition",
      position: { x: 420, y: 350 },
      subtitle: "Condition",
      description: "현재 선택 행동의 최소·최대 거리를 검사합니다.",
    },
    {
      id: "bt-select",
      name: "Select Attack",
      kind: "task",
      position: { x: 610, y: 350 },
      subtitle: "Action",
      action: "Score_Attacks",
      description: "사용 가능한 행동 가운데 최고 점수를 선택합니다.",
    },
  ],
  edges: [
    { id: "bt-e1", source: "bt-root", target: "bt-react", priority: 0 },
    { id: "bt-e2", source: "bt-root", target: "bt-combat", priority: 1 },
    { id: "bt-e3", source: "bt-root", target: "bt-chase", priority: 2 },
    { id: "bt-e4", source: "bt-react", target: "bt-threat", priority: 0 },
    { id: "bt-e5", source: "bt-react", target: "bt-guard", priority: 1 },
    { id: "bt-e6", source: "bt-combat", target: "bt-range", priority: 0 },
    { id: "bt-e7", source: "bt-combat", target: "bt-select", priority: 1 },
  ],
};

export const sampleProject: {
  id: string;
  name: string;
  fileName: string;
  graphs: { fsm: GraphDefinition; hfsm: GraphDefinition; bt: GraphDefinition };
  blackboard: BlackboardEntry[];
  trace: TraceEvent[];
  assets: AssetRecord[];
} = {
  id: "project-cinder-knight",
  name: "Cinder Knight",
  fileName: "CinderKnight.combat",
  graphs: {
    fsm: normalizeSampleGraph(legacyFsm),
    hfsm: normalizeSampleGraph(legacyHfsm),
    bt: normalizeSampleGraph(legacyBt),
  },
  blackboard: [
    {
      key: "TargetActor",
      type: "Object",
      defaultValue: "None",
      liveValue: "PlayerCharacter_0",
      source: "Target Sensor",
    },
    {
      key: "DistanceToTarget",
      type: "Float",
      defaultValue: "0.0",
      liveValue: "3.42",
      source: "Target Sensor",
    },
    {
      key: "HasLineOfSight",
      type: "Bool",
      defaultValue: "false",
      liveValue: "true",
      source: "Vision Sensor",
    },
    {
      key: "SelectedAttack",
      type: "Object",
      defaultValue: "None",
      liveValue: "Attack_HeavySlam",
      source: "Score Attacks",
    },
    {
      key: "HeavySlamCooldown",
      type: "Float",
      defaultValue: "0.0",
      liveValue: "2.18",
      source: "Cooldown System",
    },
    {
      key: "WasInterrupted",
      type: "Bool",
      defaultValue: "false",
      liveValue: "false",
      source: "Action Runtime",
    },
  ],
  trace: [
    {
      tick: 1840,
      time: "30.667",
      category: "State",
      message: "Entered Select Attack",
      entity: "hfsm-select",
    },
    {
      tick: 1841,
      time: "30.683",
      category: "Condition",
      message: "HeavySlam score 0.82 — passed",
      entity: "hfsm-e4",
    },
    {
      tick: 1842,
      time: "30.700",
      category: "State",
      message: "Transition Select Attack → Heavy Slam",
      entity: "hfsm-heavy",
    },
    {
      tick: 1864,
      time: "31.067",
      category: "Action",
      message: "Attack window opened at frame 22",
      entity: "Attack_HeavySlam",
    },
    {
      tick: 1868,
      time: "31.133",
      category: "Hit",
      message: "Weapon sweep hit PlayerCharacter_0",
      entity: "Attack_HeavySlam",
    },
  ],
  assets: [
    {
      id: "asset-character",
      name: "SK_CinderKnight",
      type: "Character",
      path: "Characters/CinderKnight",
      status: "Ready",
    },
    {
      id: "asset-idle",
      name: "A_Idle_Combat",
      type: "Animation",
      path: "Animations/Locomotion",
      status: "Ready",
    },
    {
      id: "asset-slam",
      name: "A_Attack_HeavySlam",
      type: "Animation",
      path: "Animations/Combat",
      status: "Ready",
    },
    {
      id: "asset-action",
      name: "Attack_HeavySlam",
      type: "Action",
      path: "Actions/Boss",
      status: "Draft",
    },
    {
      id: "asset-graph",
      name: "CinderKnight_Combat",
      type: "Graph",
      path: "AI/Boss",
      status: "Ready",
    },
    {
      id: "asset-encounter",
      name: "Arena_Test",
      type: "Encounter",
      path: "Encounters/Test",
      status: "Ready",
    },
  ],
};

export function getGraph(mode: "fsm" | "hfsm" | "bt"): GraphDefinition {
  return sampleProject.graphs[mode];
}

function normalizeSampleGraph(input: LegacySampleGraph): GraphDefinition {
  if (input.mode === "bt") {
    return { ...structuredClone(input), mode: "bt", scopes: [], groups: [] };
  }
  const rootScopeId = `${input.id}:root`;
  const groups = structuredClone(input.groups);
  const scopes: GraphDefinition["scopes"] = [
    {
      id: rootScopeId,
      name: "루트",
      initialNodeId: input.nodes.some((node) => node.id === input.initialNodeId && !node.parentId)
        ? input.initialNodeId
        : input.nodes.find((node) => !node.parentId && node.kind === "state")?.id,
      history: "none",
      regionMode: "exclusive",
    },
    ...groups.map((group) => ({
      id: group.id,
      name: group.name,
      parentScopeId: group.parentId || rootScopeId,
      ownerNodeId: `${group.id}:owner`,
      initialNodeId: group.initialNodeId,
      history: group.history ?? "none",
      regionMode: group.regionMode ?? "exclusive",
    })),
  ];
  const nodes = input.nodes.map((node) => ({
    ...structuredClone(node),
    scopeId: node.parentId || rootScopeId,
    parentId: undefined,
  }));
  groups.forEach((group) => {
    nodes.push({
      id: `${group.id}:owner`,
      name: group.name,
      kind: "submachine",
      scopeId: group.parentId || rootScopeId,
      childScopeId: group.id,
      position: { ...group.position },
      subtitle: "행동 묶음",
      parentId: undefined,
    });
  });
  return ensureAllScopeSystemNodes({
    id: input.id,
    mode: "state-machine",
    name: input.name,
    initialNodeId: scopes[0].initialNodeId,
    nodes,
    edges: structuredClone(input.edges),
    groups: [],
    scopes,
    rootScopeId,
  });
}


/** PR3 demo — readable Situation → Decision → Action flow on the Behavior Canvas. */
export function createGuardBehaviorGraph(): GraphDefinition {
  const graphId = "graph-guard-behavior";
  const scopeId = `${graphId}:root`;
  const patrol = "guard-patrol";
  const alert = "guard-alert";
  const decide = "guard-decide";
  const attack = "guard-attack";
  const support = "guard-support";
  const retreat = "guard-retreat";
  const graph: GraphDefinition = {
    id: graphId,
    mode: "state-machine",
    name: "경비 행동",
    description: "순찰 → 발견 → 경계 → 판단 → 공격/지원/후퇴 (멀면 접근 목표·실행 계획)",
    nodes: [
      { id: patrol, name: "순찰", kind: "state", scopeId, position: { x: 80, y: 200 }, subtitle: "상황", domain: { entityKind: "state", timing: {} }, description: "지정 경로를 돌며 주변을 살핍니다." },
      { id: alert, name: "경계", kind: "state", scopeId, position: { x: 320, y: 200 }, subtitle: "상황", domain: { entityKind: "state", timing: {} }, description: "플레이어를 발견해 경계를 높인 상태" },
      {
        id: decide,
        name: "행동 판단",
        kind: "state",
        scopeId,
        position: { x: 560, y: 200 },
        subtitle: "판단",
        domain: {
          entityKind: "decision",
          decisionKind: "UTILITY",
          weights: {},
          candidateActionIds: [attack, support, retreat],
          candidates: [
            {
              id: "cand-attack",
              actionNodeId: attack,
              hardRequirements: [
                {
                  id: "req-cd",
                  variableKey: "CooldownReady",
                  operator: "is_true",
                },
              ],
              considerations: [
                {
                  id: "con-dist-atk",
                  variableKey: "플레이어 거리",
                  evalStyle: "closer_better",
                  range: { min: 0, max: 10, unit: "m" },
                  influence: "high",
                  internalWeight: 1,
                  internalCurve: "inverse",
                },
              ],
            },
            {
              id: "cand-support",
              actionNodeId: support,
              hardRequirements: [
                {
                  id: "req-ally",
                  variableKey: "아군 수",
                  operator: "gt",
                  value: "0",
                },
              ],
              considerations: [
                {
                  id: "con-ally",
                  variableKey: "아군 수",
                  evalStyle: "higher_better",
                  range: { min: 1, max: 5 },
                  influence: "medium",
                  internalWeight: 0.6,
                  internalCurve: "linear",
                },
              ],
            },
            {
              id: "cand-retreat",
              actionNodeId: retreat,
              hardRequirements: [],
              considerations: [
                {
                  id: "con-hp",
                  variableKey: "내 HP",
                  evalStyle: "lower_better",
                  range: { min: 0, max: 30 },
                  influence: "high",
                  internalWeight: 1,
                  internalCurve: "inverse",
                },
                {
                  id: "con-dist-ret",
                  variableKey: "플레이어 거리",
                  evalStyle: "farther_better",
                  range: { min: 8, max: 30, unit: "m" },
                  influence: "low",
                  internalWeight: 0.3,
                  internalCurve: "linear",
                },
              ],
            },
          ],
        },
      },
      {
        id: attack,
        name: "공격",
        kind: "state",
        scopeId,
        position: { x: 800, y: 80 },
        subtitle: "행동",
        domain: {
          entityKind: "action",
          timing: {},
          interruptible: true,
          intent: "접근해 타격을 가한다",
          executeAction: "Play_Attack",
          completionCondition: "공격 애니메이션 종료",
        },
        action: "Play_Attack",
      },
      {
        id: support,
        name: "지원요청",
        kind: "state",
        scopeId,
        position: { x: 800, y: 200 },
        subtitle: "행동",
        domain: {
          entityKind: "action",
          timing: {},
          interruptible: true,
          intent: "아군에게 지원을 요청한다",
          executeAction: "Call_Support",
          completionCondition: "신호 송신 완료",
        },
        action: "Call_Support",
      },
      {
        id: retreat,
        name: "후퇴",
        kind: "state",
        scopeId,
        position: { x: 800, y: 320 },
        subtitle: "행동",
        domain: {
          entityKind: "action",
          timing: {},
          interruptible: true,
          intent: "안전한 위치로 물러난다",
          executeAction: "Move_Retreat",
          completionCondition: "후퇴 지점 도달",
        },
        action: "Move_Retreat",
      },
    ],
    edges: [
      {
        id: "guard-e1",
        source: patrol,
        target: alert,
        triggerType: "event",
        eventName: "플레이어 발견",
        label: "플레이어 발견",
        priority: 0,
      },
      {
        id: "guard-e2",
        source: alert,
        target: decide,
        triggerType: "always",
        priority: 0,
      },
      // Decision → Candidate Action: candidate links (no IF/ELSE flow-condition labels)
      {
        id: "guard-e3",
        source: decide,
        target: attack,
        triggerType: "always",
        label: "후보",
        priority: 0,
        accent: "success",
      },
      {
        id: "guard-e4",
        source: decide,
        target: support,
        triggerType: "always",
        label: "후보",
        priority: 1,
        accent: "success",
      },
      {
        id: "guard-e5",
        source: decide,
        target: retreat,
        triggerType: "always",
        label: "후보",
        priority: 2,
        accent: "success",
      },
    ],
    groups: [],
    scopes: [{ id: scopeId, name: "경비", history: "none", regionMode: "exclusive", initialNodeId: patrol }],
    rootScopeId: scopeId,
    initialNodeId: patrol,
  };
  return ensureAllScopeSystemNodes(graph);
}


