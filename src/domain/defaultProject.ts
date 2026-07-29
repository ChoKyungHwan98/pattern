import {
  type ActionDefinition,
  type CollisionTimelineItem,
  type ConditionExpr,
  createId,
  type DefenseTimelineItem,
  type FsmGraph,
  type ProjectDocument,
  type ProjectileTimelineItem,
  type StateNode,
  type TimelineItem,
  type TimelineTrack,
  type TimelineTrackKind,
} from "./project";

const compare = (
  sensor: Extract<ConditionExpr, { kind: "compare" }>["sensor"],
  operator: Extract<ConditionExpr, { kind: "compare" }>["operator"],
  value: boolean | number | string,
): ConditionExpr => ({ kind: "compare", sensor, operator, value });

const trackNames: Record<TimelineTrackKind, string> = {
  animation: "애니메이션",
  movement: "이동 · 루트 모션",
  collision: "판정",
  projectile: "투사체 · 소환",
  cancel: "취소 가능 구간",
  effect: "효과",
  sound: "소리",
  camera: "카메라",
  hitStop: "히트 스톱",
  event: "사용자 이벤트",
};

const makeTracks = (): TimelineTrack[] =>
  (Object.keys(trackNames) as TimelineTrackKind[]).map((kind) => ({
    id: createId("track"),
    kind,
    name: trackNames[kind],
    locked: false,
    muted: false,
  }));

const action = (name: string, durationTicks: number): ActionDefinition => ({
  id: createId("action"),
  name,
  durationTicks,
  tickRate: 60,
  tracks: makeTracks(),
  items: [],
});

const addItem = <T extends TimelineItem>(
  target: ActionDefinition,
  trackKind: TimelineTrackKind,
  item: Omit<T, "trackId">,
) => {
  const trackId = target.tracks.find((track) => track.kind === trackKind)?.id;
  if (!trackId) return;
  target.items.push({ ...item, trackId } as T);
};

const state = (name: string, x: number, y: number): StateNode => ({
  id: createId("state"),
  name,
  position: { x, y },
  entryActionIds: [],
  updateActionIds: [],
  exitActionIds: [],
});

export function createDefaultProject(name = "새 전투 AI 프로젝트"): ProjectDocument {
  const now = new Date().toISOString();
  const slash = action("검 베기", 72);
  const fireball = action("화염구", 96);
  const guard = action("가드", 60);
  const parry = action("패링", 48);

  addItem<CollisionTimelineItem>(slash, "collision", {
    id: createId("item"),
    type: "collision",
    name: "검 궤적 판정",
    startTick: 22,
    endTick: 34,
    role: "attack",
    socket: "weapon_r",
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    shape3d: { kind: "capsule", radius: 0.16, length: 1.1 },
    continuous: true,
    damage: 12,
  });
  addItem<ProjectileTimelineItem>(fireball, "projectile", {
    id: createId("item"),
    type: "projectile",
    name: "손 소켓 화염구",
    startTick: 42,
    endTick: 43,
    socket: "hand_r",
    speed: 10,
    lifetimeTicks: 180,
    gravity: 0,
    damage: 16,
    collisionRadius: 0.28,
  });
  addItem<DefenseTimelineItem>(guard, "collision", {
    id: createId("item"),
    type: "defense",
    name: "가드 성공 구간",
    startTick: 8,
    endTick: 52,
    role: "guard",
    angleDegrees: 120,
    damageMultiplier: 0.2,
  });
  addItem<DefenseTimelineItem>(parry, "collision", {
    id: createId("item"),
    type: "defense",
    name: "패링 성공 구간",
    startTick: 12,
    endTick: 20,
    role: "parry",
    angleDegrees: 100,
    damageMultiplier: 0,
  });

  const idle = state("대기", 80, 170);
  const chase = state("추적", 340, 80);
  const attack = state("공격", 620, 80);
  const defend = state("방어", 340, 300);
  const recover = state("후딜", 900, 170);
  attack.entryActionIds = [slash.id];
  defend.entryActionIds = [guard.id];

  const graph: FsmGraph = {
    id: createId("graph"),
    kind: "fsm",
    name: "적 검사 FSM",
    initialStateId: idle.id,
    states: [idle, chase, attack, defend, recover],
    transitions: [
      {
        id: createId("transition"),
        sourceStateId: idle.id,
        targetStateId: chase.id,
        conditions: compare("target.visible", "eq", true),
        priority: 10,
        interruptPolicy: "source",
      },
      {
        id: createId("transition"),
        sourceStateId: chase.id,
        targetStateId: attack.id,
        conditions: compare("target.distance", "lte", 2.4),
        priority: 10,
        interruptPolicy: "source",
      },
      {
        id: createId("transition"),
        sourceStateId: chase.id,
        targetStateId: defend.id,
        conditions: compare("target.action", "eq", "검 공격"),
        priority: 20,
        interruptPolicy: "immediate",
      },
      {
        id: createId("transition"),
        sourceStateId: attack.id,
        targetStateId: recover.id,
        conditions: compare("self.cooldownReady", "eq", true),
        priority: 10,
        interruptPolicy: "source",
      },
      {
        id: createId("transition"),
        sourceStateId: defend.id,
        targetStateId: chase.id,
        conditions: compare("self.cooldownReady", "eq", true),
        priority: 10,
        interruptPolicy: "source",
      },
      {
        id: createId("transition"),
        sourceStateId: recover.id,
        targetStateId: chase.id,
        conditions: compare("self.cooldownReady", "eq", true),
        priority: 10,
        interruptPolicy: "source",
      },
    ],
  };

  const playerId = createId("actor");
  const enemyId = createId("actor");

  return {
    schemaVersion: 1,
    project: {
      id: createId("project"),
      name,
      createdAt: now,
      updatedAt: now,
    },
    spaceMode: "3d",
    assets: [],
    variables: [],
    actors: [
      {
        id: playerId,
        name: "플레이어",
        defaultActionId: slash.id,
        isPlayerControlled: true,
      },
      {
        id: enemyId,
        name: "적 검사",
        graphId: graph.id,
        defaultActionId: slash.id,
        isPlayerControlled: false,
      },
    ],
    actions: [slash, fireball, guard, parry],
    behaviorGraphs: [graph],
    testScenes: [
      {
        id: createId("scene"),
        name: "기본 전투 실험",
        actorIds: [playerId, enemyId],
        seed: 1042,
      },
    ],
    editor: {
      workspace: "ai",
      selectedActionId: slash.id,
      selectedGraphId: graph.id,
      selectedStateId: idle.id,
      selectedTimelineItemIds: [],
      timelineZoom: 8,
    },
  };
}
