import type {
  GraphDefinition,
  GraphEdge,
  GraphGroup,
  GraphMode,
  GraphNode,
  LegacyGraphMode,
  PatternLibrary,
  PatternSet,
  StateMachineScope,
} from "./model";
import { sampleProject } from "./sampleProject";
import { ensureAllScopeSystemNodes } from "./stateMachine";

const STORAGE_PREFIX = "game-design-studio.pattern-library.v2";
const LEGACY_STORAGE_PREFIX = "game-design-studio.pattern-library.v1";

export function getWorkspaceId(): string {
  const workspaceId = new URLSearchParams(window.location.search).get("workspaceId")?.trim();
  return workspaceId || "standalone";
}

export function createEmptyLibrary(workspaceId: string): PatternLibrary {
  return { schemaVersion: 2, workspaceId, sets: [] };
}

export function loadPatternLibrary(workspaceId: string): PatternLibrary {
  const primaryKey = storageKey(STORAGE_PREFIX, workspaceId);
  const v2 = readJson(primaryKey) ?? readJson(`${primaryKey}:pending`) ?? latestRecovery(primaryKey);
  if (v2) return migratePatternLibrary(v2, workspaceId);

  const legacyKey = storageKey(LEGACY_STORAGE_PREFIX, workspaceId);
  const legacy = readJson(legacyKey);
  if (!legacy) return createEmptyLibrary(workspaceId);

  const backupKey = `${legacyKey}:migration-backup`;
  if (!window.localStorage.getItem(backupKey)) {
    window.localStorage.setItem(backupKey, JSON.stringify(legacy));
  }
  const migrated = migratePatternLibrary(legacy, workspaceId);
  savePatternLibrary(migrated);
  return migrated;
}

export function migratePatternLibrary(raw: unknown, workspaceId: string): PatternLibrary {
  const candidate = asRecord(raw);
  const sets = Array.isArray(candidate?.sets) ? candidate.sets : [];
  return {
    schemaVersion: 2,
    workspaceId,
    sets: sets.map((set) => normalizePatternSet(set)).filter(Boolean) as PatternSet[],
  };
}

export function savePatternLibrary(library: PatternLibrary): void {
  const key = storageKey(STORAGE_PREFIX, library.workspaceId);
  const serialized = JSON.stringify(library);
  try {
    const previous = window.localStorage.getItem(key);
    if (previous && previous !== serialized) {
      const journal = readJson(`${key}:recovery`);
      const entries = Array.isArray(journal) ? journal : [];
      entries.unshift({ savedAt: new Date().toISOString(), data: JSON.parse(previous) });
      window.localStorage.setItem(`${key}:recovery`, JSON.stringify(entries.slice(0, 5)));
    }
    window.localStorage.setItem(`${key}:pending`, serialized);
    window.localStorage.setItem(key, serialized);
    window.localStorage.removeItem(`${key}:pending`);
  } catch {
    window.localStorage.setItem(key, serialized);
  }
}

export function getRecoveryCount(workspaceId: string): number {
  const journal = readJson(`${storageKey(STORAGE_PREFIX, workspaceId)}:recovery`);
  return Array.isArray(journal) ? journal.length : 0;
}

export function restoreLatestRecovery(workspaceId: string): PatternLibrary | undefined {
  const restored = latestRecovery(storageKey(STORAGE_PREFIX, workspaceId));
  return restored ? migratePatternLibrary(restored, workspaceId) : undefined;
}

export function createPatternSet(name: string, description = ""): PatternSet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "새 패턴 세트",
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    graphs: [],
    blackboard: [],
    actions: [],
    conditions: [],
    templates: [],
  };
}

export function createGraph(mode: GraphMode, name: string): GraphDefinition {
  const now = new Date().toISOString();
  const graphId = crypto.randomUUID();
  const starter = starterGraph(mode, graphId);
  return {
    id: graphId,
    mode,
    name: name.trim() || defaultGraphName(mode),
    createdAt: now,
    updatedAt: now,
    ...starter,
  };
}

export function createSamplePatternSet(): PatternSet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Cinder Knight 예제",
    description: "계층 상태 머신과 행동 트리를 함께 살펴보는 예제 세트입니다.",
    createdAt: now,
    updatedAt: now,
    graphs: Object.values(sampleProject.graphs).map((graph) => ({ ...normalizeGraph(graph), createdAt: now, updatedAt: now })),
    blackboard: structuredClone(sampleProject.blackboard),
    actions: defaultActions(),
    conditions: defaultConditions(),
    templates: [],
  };
}

export function touchSet(set: PatternSet): PatternSet {
  return { ...set, updatedAt: new Date().toISOString() };
}

export function duplicateGraphDefinition(source: GraphDefinition): GraphDefinition {
  const graphId = crypto.randomUUID();
  const nodeIds = new Map(source.nodes.map((node) => [node.id, `${graphId}:node:${crypto.randomUUID()}`]));
  const scopeIds = new Map(source.scopes.map((scope) => [scope.id, `${graphId}:scope:${crypto.randomUUID()}`]));
  const now = new Date().toISOString();
  return {
    ...structuredClone(source),
    id: graphId,
    name: `${source.name} 복사본`,
    createdAt: now,
    updatedAt: now,
    rootScopeId: source.rootScopeId ? scopeIds.get(source.rootScopeId) : undefined,
    initialNodeId: source.initialNodeId ? nodeIds.get(source.initialNodeId) : undefined,
    rootNodeId: source.rootNodeId ? nodeIds.get(source.rootNodeId) : undefined,
    nodes: source.nodes.map((node) => ({
      ...structuredClone(node),
      id: nodeIds.get(node.id)!,
      scopeId: node.scopeId ? scopeIds.get(node.scopeId) : undefined,
      childScopeId: node.childScopeId ? scopeIds.get(node.childScopeId) : undefined,
    })),
    edges: source.edges.map((edge) => ({ ...structuredClone(edge), id: `${graphId}:edge:${crypto.randomUUID()}`, source: nodeIds.get(edge.source) ?? edge.source, target: nodeIds.get(edge.target) ?? edge.target })),
    scopes: source.scopes.map((scope) => ({
      ...structuredClone(scope),
      id: scopeIds.get(scope.id)!,
      parentScopeId: scope.parentScopeId ? scopeIds.get(scope.parentScopeId) : undefined,
      ownerNodeId: scope.ownerNodeId ? nodeIds.get(scope.ownerNodeId) : undefined,
      initialNodeId: scope.initialNodeId ? nodeIds.get(scope.initialNodeId) : undefined,
    })),
  };
}

export function normalizeGraph(input: unknown): GraphDefinition {
  const raw = asRecord(input) ?? {};
  const id = stringValue(raw.id) || crypto.randomUUID();
  const legacyMode = raw.mode as GraphMode | LegacyGraphMode | undefined;
  const mode: GraphMode = legacyMode === "bt" ? "bt" : "state-machine";
  const nodes = Array.isArray(raw.nodes) ? structuredClone(raw.nodes as GraphNode[]) : [];
  const edges = Array.isArray(raw.edges) ? structuredClone(raw.edges as GraphEdge[]) : [];
  const groups = Array.isArray(raw.groups) ? structuredClone(raw.groups as GraphGroup[]) : [];
  const existingScopes = Array.isArray(raw.scopes)
    ? structuredClone(raw.scopes as StateMachineScope[])
    : [];

  if (mode === "bt") {
    return {
      id,
      mode,
      name: stringValue(raw.name) || "새 행동 트리",
      description: stringValue(raw.description),
      createdAt: stringValue(raw.createdAt),
      updatedAt: stringValue(raw.updatedAt),
      nodes: nodes.map((node) => ({ ...node, scopeId: undefined, parentId: undefined })),
      edges,
      scopes: [],
      groups: [],
      rootNodeId: stringValue(raw.rootNodeId) || nodes[0]?.id,
    };
  }

  const rootScopeId = stringValue(raw.rootScopeId) || `${id}:root`;
  const scopes = existingScopes.length
    ? existingScopes.map((scope) => ({
        ...scope,
        history: scope.history ?? "none",
        regionMode: scope.regionMode ?? "exclusive",
      }))
    : legacyScopes(groups, rootScopeId, "루트");
  if (!scopes.some((scope) => scope.id === rootScopeId)) {
    scopes.unshift(rootScope(rootScopeId, "루트"));
  }

  const normalizedNodes = nodes.map((node) => ({
    ...node,
    kind: node.kind === ("compound" as GraphNode["kind"]) ? "submachine" as const : node.kind,
    scopeId: node.scopeId || node.parentId || rootScopeId,
    parentId: undefined,
  }));

  if (!existingScopes.length) {
    groups.forEach((group) => {
      const ownerNodeId = `${group.id}:owner`;
      const scope = scopes.find((item) => item.id === group.id);
      if (scope) scope.ownerNodeId = ownerNodeId;
      if (!normalizedNodes.some((node) => node.id === ownerNodeId)) {
        normalizedNodes.push({
          id: ownerNodeId,
          name: group.name,
          kind: "submachine",
          scopeId: group.parentId || rootScopeId,
          childScopeId: group.id,
          position: { ...group.position },
          subtitle: "하위 상태 머신",
          parentId: undefined,
        });
      }
    });
  }

  const initialNodeId = stringValue(raw.initialNodeId)
    || normalizedNodes.find((node) => node.scopeId === rootScopeId && node.kind === "state")?.id;
  const root = scopes.find((scope) => scope.id === rootScopeId);
  if (root && !root.initialNodeId) {
    root.initialNodeId = normalizedNodes.some((node) => node.id === initialNodeId && node.scopeId === rootScopeId)
      ? initialNodeId
      : normalizedNodes.find((node) => node.scopeId === rootScopeId && (node.kind === "state" || node.kind === "submachine"))?.id;
  }

  return ensureAllScopeSystemNodes({
    id,
    mode,
    name: stringValue(raw.name) || "새 상태 머신",
    description: stringValue(raw.description),
    createdAt: stringValue(raw.createdAt),
    updatedAt: stringValue(raw.updatedAt),
    nodes: normalizedNodes,
    edges,
    scopes,
    rootScopeId,
    groups: [],
    initialNodeId: root?.initialNodeId ?? initialNodeId,
  });
}

function normalizePatternSet(input: unknown): PatternSet | undefined {
  const raw = asRecord(input);
  if (!raw) return undefined;
  const now = new Date().toISOString();
  return {
    id: stringValue(raw.id) || crypto.randomUUID(),
    name: stringValue(raw.name) || "이름 없는 패턴 세트",
    description: stringValue(raw.description),
    createdAt: stringValue(raw.createdAt) || now,
    updatedAt: stringValue(raw.updatedAt) || now,
    graphs: Array.isArray(raw.graphs) ? raw.graphs.map(normalizeGraph) : [],
    blackboard: Array.isArray(raw.blackboard) ? structuredClone(raw.blackboard as PatternSet["blackboard"]) : [],
    actions: Array.isArray(raw.actions) ? structuredClone(raw.actions as PatternSet["actions"]) : [],
    conditions: Array.isArray(raw.conditions) ? structuredClone(raw.conditions as PatternSet["conditions"]) : [],
    templates: Array.isArray(raw.templates) ? structuredClone(raw.templates as PatternSet["templates"]) : [],
  };
}

function starterGraph(mode: GraphMode, graphId: string): Pick<GraphDefinition, "nodes" | "edges" | "groups" | "scopes" | "rootScopeId" | "initialNodeId" | "rootNodeId"> {
  if (mode === "bt") {
    const rootId = `${graphId}-root`;
    const taskId = `${graphId}-task`;
    return {
      nodes: [
        { id: rootId, name: "Root", kind: "selector", position: { x: 420, y: 150 }, subtitle: "선택" },
        { id: taskId, name: "첫 행동", kind: "task", position: { x: 420, y: 290 }, subtitle: "행동" },
      ],
      edges: [{ id: `${graphId}-edge-1`, source: rootId, target: taskId, priority: 0 }],
      groups: [], scopes: [], rootNodeId: rootId,
    };
  }

  const scopeId = `${graphId}:root`;
  const idleId = `${graphId}-idle`;
  const graph: GraphDefinition = {
    id: graphId,
    mode,
    name: "새 상태 머신",
    nodes: [{ id: idleId, name: "Idle", kind: "state", scopeId, position: { x: 420, y: 220 }, subtitle: "기본 상태" }],
    edges: [], groups: [],
    scopes: [{ ...rootScope(scopeId, "루트"), initialNodeId: idleId }],
    rootScopeId: scopeId,
    initialNodeId: idleId,
  };
  const ready = ensureAllScopeSystemNodes(graph);
  return {
    nodes: ready.nodes,
    edges: ready.edges,
    groups: [],
    scopes: ready.scopes,
    rootScopeId: scopeId,
    initialNodeId: idleId,
  };
}

function legacyScopes(groups: GraphGroup[], rootScopeId: string, rootName: string): StateMachineScope[] {
  return [
    rootScope(rootScopeId, rootName),
    ...groups.map((group) => ({
      id: group.id,
      name: group.name,
      parentScopeId: group.parentId || rootScopeId,
      initialNodeId: group.initialNodeId,
      history: group.history ?? "none",
      regionMode: group.regionMode ?? "exclusive",
    } as StateMachineScope)),
  ];
}

function rootScope(id: string, name: string): StateMachineScope {
  return { id, name, history: "none", regionMode: "exclusive" };
}

function defaultGraphName(mode: GraphMode): string {
  return mode === "bt" ? "새 행동 트리" : "새 상태 머신";
}

function defaultActions(): PatternSet["actions"] {
  return [
    { id: "move-to-target", name: "Move To Target", description: "대상까지 이동합니다.", parameters: [], unityType: "MoveToTargetAction", unrealType: "GDSStateTreeMoveToTargetTask" },
    { id: "play-action", name: "Play Action", description: "애니메이션 또는 전투 행동을 실행합니다.", parameters: [{ id: "action", name: "Action", type: "String", defaultValue: "" }], unityType: "PlayActionState", unrealType: "GDSStateTreePlayActionTask" },
  ];
}

function defaultConditions(): PatternSet["conditions"] {
  return [
    { id: "blackboard-compare", name: "Blackboard Compare", description: "블랙보드 값을 비교합니다.", parameters: [{ id: "key", name: "Key", type: "String", defaultValue: "" }], resultType: "Bool", unityType: "BlackboardCondition", unrealType: "GDSStateTreeBlackboardCondition" },
  ];
}

function storageKey(prefix: string, workspaceId: string): string {
  return `${prefix}:${workspaceId}`;
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function latestRecovery(primaryKey: string): unknown {
  const journal = readJson(`${primaryKey}:recovery`);
  if (!Array.isArray(journal)) return undefined;
  const entry = journal.find((item) => asRecord(item)?.data);
  return asRecord(entry)?.data;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
