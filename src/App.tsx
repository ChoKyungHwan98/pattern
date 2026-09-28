import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, PanelRightOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createDomainGraphNode, type DomainEntityKind } from "./editor/domain";
import {
  createConditionGraphNode,
  firstSelectableNodeId,
  findScopeSystemNode,
  type BehaviorPaletteId,
} from "./editor/behaviorUi";
import {
  ANYWHERE_INTERRUPT_LABEL,
  FLOW_CONDITION_PROMPT,
  classifyAuthoringLink,
  createContextVariableEntry,
} from "./editor/authoringFlow";
import type { ReactNode } from "react";
import { BottomPanel } from "./components/BottomPanel";
import { CreateGraphDialog } from "./components/CreateGraphDialog";
import { EditorChrome } from "./components/EditorChrome";
import { GraphEditor, type GraphViewportCommand } from "./components/GraphEditor";
import { HierarchyPanel } from "./components/HierarchyPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { PatternSetLibrary } from "./components/PatternSetLibrary";
import { ShortcutHelpDialog } from "./components/ShortcutHelpDialog";
import { TransitionInspectorPanel } from "./components/TransitionInspectorPanel";
import { deleteGraphEdge, deleteGraphNode, duplicateGraphNode } from "./editor/graphCommands";
import { validateGraph } from "./editor/graphValidation";
import type { BlackboardEntry, DrawerTab, GraphDefinition, GraphEdge, GraphMode, GraphNode, PatternLibrary, PatternSet, Point, RuntimeState } from "./editor/model";
import { serializePatternIr } from "./editor/patternIr";
import {
  createGraph,
  createPatternSet,
  createSamplePatternSet,
  duplicateGraphDefinition,
  getWorkspaceId,
  loadPatternLibrary,
  savePatternLibrary,
  touchSet,
} from "./editor/patternLibrary";
import { createPatternRuntime } from "./runtime/createPatternRuntime";
import type { PatternRuntime, PatternRuntimeSnapshot } from "./runtime/types";
import type { EngineExportTarget } from "./adapters/engineManifest";
import { createChildMachine, getRootScope, isSystemNode, scopePath } from "./editor/stateMachine";
import { createDiagnosticsReport } from "./editor/diagnostics";
import { publishPatternArtifacts } from "./editor/studioArtifact";
import { isStudioHosted, useScreenHistory } from "./editor/screenHistory";

export function App() {
  const [library, setLibrary] = useState<PatternLibrary>(() => loadPatternLibrary(getWorkspaceId()));
  const [activeSetId, setActiveSetId] = useState<string>();
  const activeSet = library.sets.find((set) => set.id === activeSetId);
  useScreenHistory(activeSetId, setActiveSetId);

  useEffect(() => {
    savePatternLibrary(library);
    const timer = window.setTimeout(() => publishPatternArtifacts(library), 500);
    return () => window.clearTimeout(timer);
  }, [library]);

  const updateSet = (nextSet: PatternSet) => {
    setLibrary((current) => ({
      ...current,
      sets: current.sets.map((set) => set.id === nextSet.id ? nextSet : set),
    }));
  };

  const createSet = (name: string, description: string) => {
    const set = createPatternSet(name, description);
    setLibrary((current) => ({ ...current, sets: [set, ...current.sets] }));
    setActiveSetId(set.id);
  };

  const createSample = () => {
    const set = createSamplePatternSet();
    setLibrary((current) => ({ ...current, sets: [set, ...current.sets] }));
    setActiveSetId(set.id);
  };

  if (activeSet) {
    return <PatternSetEditor set={activeSet} onChange={updateSet} onBack={() => setActiveSetId(undefined)} />;
  }

  return <PatternSetLibrary sets={library.sets} onCreate={createSet} onOpen={setActiveSetId} onSampleCreate={createSample} />;
}

function PatternSetEditor({ set, onChange, onBack }: { set: PatternSet; onChange: (set: PatternSet) => void; onBack: () => void }) {
  const [selectedGraphId, setSelectedGraphId] = useState<string | undefined>(set.graphs[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const setRef = useRef(set);
  useEffect(() => { setRef.current = set; }, [set]);
  const commitSet = (next: PatternSet) => {
    setRef.current = next;
    onChange(next);
  };
  const graph = set.graphs.find((item) => item.id === selectedGraphId) ?? set.graphs[0];

  const addGraph = (mode: GraphMode, name: string, description?: string) => {
    const current = setRef.current;
    const newGraph = createGraph(mode, name, description);
    commitSet(touchSet({ ...current, graphs: [...current.graphs, newGraph] }));
    setSelectedGraphId(newGraph.id);
    setCreateOpen(false);
  };

  const updateGraph = (nextGraph: GraphDefinition) => {
    const current = setRef.current;
    const now = new Date().toISOString();
    commitSet(touchSet({
      ...current,
      graphs: current.graphs.map((item) => item.id === nextGraph.id ? { ...nextGraph, updatedAt: now } : item),
    }));
  };
  const renameGraph = (graphId: string, name: string) => {
    const current = setRef.current;
    commitSet(touchSet({ ...current, graphs: current.graphs.map((item) => item.id === graphId ? { ...item, name, updatedAt: new Date().toISOString() } : item) }));
  };
  const duplicateGraph = (graphId: string) => {
    const current = setRef.current;
    const source = current.graphs.find((item) => item.id === graphId);
    if (!source) return;
    const copy = duplicateGraphDefinition(source);
    commitSet(touchSet({ ...current, graphs: [...current.graphs, copy] }));
    setSelectedGraphId(copy.id);
  };
  const deleteGraph = (graphId: string) => {
    const current = setRef.current;
    const remaining = current.graphs.filter((item) => item.id !== graphId);
    commitSet(touchSet({ ...current, graphs: remaining }));
    if (selectedGraphId === graphId) setSelectedGraphId(remaining[0]?.id);
  };
  const mergeSetUpdate = (next: PatternSet) => {
    // GraphWorkbench may send blackboard/catalog patches with a slightly stale
    // graphs snapshot; keep whichever graph revision is newer per id.
    const current = setRef.current;
    const byId = new Map(current.graphs.map((item) => [item.id, item]));
    next.graphs.forEach((graphItem) => {
      const prior = byId.get(graphItem.id);
      if (!prior) {
        byId.set(graphItem.id, graphItem);
        return;
      }
      const nextUpdated = Date.parse(graphItem.updatedAt ?? "") || 0;
      const priorUpdated = Date.parse(prior.updatedAt ?? "") || 0;
      byId.set(graphItem.id, nextUpdated >= priorUpdated ? graphItem : prior);
    });
    commitSet(touchSet({
      ...current,
      ...next,
      graphs: [...byId.values()],
      blackboard: next.blackboard,
    }));
  };

  if (!graph) {
    return (
      <div className="editor-app editor-empty-app">
        <header className="workbench-header empty-editor-header">
          {!isStudioHosted() && (
            <button className="back-to-library" onClick={onBack}><ArrowLeft size={16} /><span>세트 목록</span></button>
          )}
          <div className="header-document"><strong>{set.name}</strong><span>그래프 문서 0개</span></div>
        </header>
        <main className="workbench-shell sidebar-open inspector-closed">
          <HierarchyPanel setName={set.name} graphs={set.graphs} selectedGraphId={selectedGraphId} onGraphChange={setSelectedGraphId} onGraphCreate={() => setCreateOpen(true)} onNodeSelect={() => undefined} />
          <section className="empty-editor-canvas">
            <span><Plus size={23} /></span>
            <strong>첫 행동 패턴을 만드세요.</strong>
            <p>상황·행동·판단으로 캐릭터 행동 흐름을 설계할 수 있습니다.</p>
            <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={15} /> 새 행동 패턴</button>
          </section>
        </main>
        {createOpen && <CreateGraphDialog onClose={() => setCreateOpen(false)} onCreate={addGraph} />}
      </div>
    );
  }

  return (
    <GraphWorkbench key={graph.id}
      set={set}
      graph={graph}
      selectedGraphId={graph.id}
      onGraphChange={setSelectedGraphId}
      onGraphCreate={() => setCreateOpen(true)}
      onGraphRename={renameGraph}
      onGraphDuplicate={duplicateGraph}
      onGraphDelete={deleteGraph}
      onGraphUpdate={updateGraph}
      onSetUpdate={mergeSetUpdate}
      onBack={onBack}
      createDialog={createOpen ? <CreateGraphDialog onClose={() => setCreateOpen(false)} onCreate={addGraph} /> : null}
    />
  );
}

function GraphWorkbench({ set, graph, selectedGraphId, onGraphChange, onGraphCreate, onGraphRename, onGraphDuplicate, onGraphDelete, onGraphUpdate, onSetUpdate, onBack, createDialog }: {
  set: PatternSet;
  graph: GraphDefinition;
  selectedGraphId: string;
  onGraphChange: (graphId: string) => void;
  onGraphCreate: () => void;
  onGraphRename: (graphId: string, name: string) => void;
  onGraphDuplicate: (graphId: string) => void;
  onGraphDelete: (graphId: string) => void;
  onGraphUpdate: (graph: GraphDefinition) => void;
  onSetUpdate: (set: PatternSet) => void;
  onBack: () => void;
  createDialog: ReactNode;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(firstSelectableNodeId(graph));
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [activeScopeId, setActiveScopeId] = useState<string | undefined>(graph.rootScopeId);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("stopped");
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<PatternRuntimeSnapshot>(() => createSnapshot(graph, set.blackboard));
  const [drawerTab, setDrawerTab] = useState<DrawerTab | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(() => !isCompactLayout());
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [viewportCommand, setViewportCommand] = useState<GraphViewportCommand>();
  const [commandNotice, setCommandNotice] = useState<string>();
  const runtimeRef = useRef<PatternRuntime | undefined>(undefined);
  const graphRef = useRef(graph);
  const setRef = useRef(set);
  const blackboardRef = useRef(set.blackboard);
  const undoStackRef = useRef<GraphHistoryEntry[]>([]);
  const redoStackRef = useRef<GraphHistoryEntry[]>([]);
  const clipboardNodeRef = useRef<GraphNode | undefined>(undefined);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId);
  const issues = useMemo(() => validateGraph(graph, set.blackboard), [graph, set.blackboard]);
  const blackboardSchemaKey = useMemo(() => set.blackboard.map((entry) => `${entry.key}:${entry.type}:${entry.defaultValue}`).join("|"), [set.blackboard]);
  const activeNodeId = runtimeState === "stopped" ? undefined : runtimeSnapshot.activeNodeId;

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { setRef.current = set; blackboardRef.current = set.blackboard; }, [set]);

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, [graph.id]);

  useEffect(() => {
    if (!commandNotice) return;
    const timer = window.setTimeout(() => setCommandNotice(undefined), 1800);
    return () => window.clearTimeout(timer);
  }, [commandNotice]);

  useEffect(() => {
    runtimeRef.current?.dispose();
    runtimeRef.current = undefined;
    if (!graphHasRunnableSituations(graph)) {
      const resetHandle = window.setTimeout(() => {
        setRuntimeSnapshot(emptyRuntimeSnapshot(graph));
        setRuntimeState("stopped");
      }, 0);
      return () => { window.clearTimeout(resetHandle); };
    }
    const runtime = createPatternRuntime(graph, blackboardRef.current);
    runtimeRef.current = runtime;
    const resetHandle = window.setTimeout(() => {
      setRuntimeSnapshot(runtime.getSnapshot());
      setRuntimeState("stopped");
    }, 0);
    return () => { window.clearTimeout(resetHandle); runtime.dispose(); };
  }, [graph, blackboardSchemaKey]);

  useEffect(() => {
    if (runtimeState !== "playing") return;
    const timer = window.setInterval(() => {
      const snapshot = runtimeRef.current?.step();
      if (snapshot) {
        setRuntimeSnapshot({ ...snapshot, state: snapshot.breakpointHit ? "paused" : "playing" });
        if (snapshot.breakpointHit) {
          setRuntimeState("paused");
          setCommandNotice(`중단점 ‘${graphRef.current.nodes.find((node) => node.id === snapshot.breakpointHit)?.name ?? snapshot.breakpointHit}’에서 멈췄습니다.`);
        }
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [runtimeState]);

  const selectGraph = (graphId: string) => {
    const nextGraph = set.graphs.find((item) => item.id === graphId);
    onGraphChange(graphId);
    setSelectedNodeId(nextGraph ? firstSelectableNodeId(nextGraph) : undefined);
    setSelectedEdgeId(undefined);
    setActiveScopeId(nextGraph?.rootScopeId);
    setDrawerTab(undefined);
    setShortcutHelpOpen(false);
    if (isCompactLayout()) setSidebarOpen(false);
  };

  const changeRuntimeState = (state: RuntimeState) => {
    if (state === "stopped") {
      const snapshot = runtimeRef.current?.reset();
      if (snapshot) setRuntimeSnapshot(snapshot);
    }
    setRuntimeState(state);
  };

  const stepRuntime = () => {
    const snapshot = runtimeRef.current?.step();
    if (!snapshot) return;
    setRuntimeState("paused");
    setRuntimeSnapshot({ ...snapshot, state: "paused" });
    setDrawerTab((current) => current ?? "simulation");
  };

  const seekRuntime = (tick: number) => {
    const snapshot = runtimeRef.current?.seek(tick);
    if (!snapshot) return;
    setRuntimeState("paused");
    setRuntimeSnapshot({ ...snapshot, state: "paused" });
  };

  const sendRuntimeEvent = (eventName: string) => {
    const snapshot = runtimeRef.current?.step(eventName);
    if (!snapshot) return;
    setRuntimeState("paused");
    setRuntimeSnapshot({ ...snapshot, state: "paused" });
    setDrawerTab("simulation");
  };

  const announce = (message: string) => setCommandNotice(message);
  const update = (transform: (current: GraphDefinition) => GraphDefinition) => {
    const current = graphRef.current;
    const next = transform(current);
    if (next === current) return false;
    undoStackRef.current.push({ graph: current, selectedNodeId, selectedEdgeId });
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    redoStackRef.current = [];
    graphRef.current = next;
    setRef.current = {
      ...setRef.current,
      graphs: setRef.current.graphs.map((item) => item.id === next.id ? next : item),
      updatedAt: new Date().toISOString(),
    };
    onGraphUpdate(next);
    return true;
  };
  const moveNode = (nodeId: string, position: Point) => update((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, position } : node) }));
  const layoutNodes = (positions: Record<string, Point>) => update((current) => ({ ...current, nodes: current.nodes.map((node) => ({ ...node, position: positions[node.id] ?? node.position })) }));
  const addDomainNode = (entityKind: DomainEntityKind, position?: Point) => {
    const index = graph.nodes.length + 1;
    const scopeId = graph.mode === "bt" ? undefined : activeScopeId ?? graph.rootScopeId;
    const wasEmpty = !graph.nodes.some((node) => !isSystemNode(node) && (graph.mode === "bt" || node.scopeId === scopeId));
    const node = createDomainGraphNode({
      mode: graph.mode,
      entityKind,
      index,
      scopeId,
      position: position ?? { x: 180 + index * 22, y: 160 + index * 18 },
    });
    // First situation gets a planner-friendly default name.
    if (wasEmpty && entityKind === "state") {
      node.name = "대기";
    }
    update((current) => ({
      ...current,
      nodes: [...current.nodes, node],
      scopes: current.scopes.map((scope) => scope.id === scopeId && !scope.initialNodeId ? { ...scope, initialNodeId: node.id } : scope),
      initialNodeId: current.rootScopeId === scopeId && !current.initialNodeId ? node.id : current.initialNodeId,
    }));
    setSelectedNodeId(node.id);
    setSelectedEdgeId(undefined);
    if (wasEmpty && entityKind === "state") {
      announce("첫 상황을 만들었습니다. 이름을 바꾸고 다음 상황·흐름을 이으세요.");
    }
  };
  const addNode = (position?: Point) => {
    addDomainNode(graph.mode === "bt" ? "action" : "state", position);
  };
  const addConditionNode = (position?: Point) => {
    const index = graph.nodes.length + 1;
    const scopeId = graph.mode === "bt" ? undefined : activeScopeId ?? graph.rootScopeId;
    const node = createConditionGraphNode({
      mode: graph.mode,
      index,
      scopeId,
      position: position ?? { x: 180 + index * 22, y: 160 + index * 18 },
    });
    update((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeId(node.id);
  };
  const addVariableFromPalette = () => {
    const entries = [...set.blackboard];
    let suffix = 1;
    while (entries.some((entry) => entry.key === `새변수${suffix}`)) suffix += 1;
    const next = [
      ...entries,
      {
        key: `새변수${suffix}`,
        type: "Float" as const,
        defaultValue: "0",
        liveValue: "0",
        source: "패턴",
      },
    ];
    updateBlackboard(next);
    setDrawerTab("context");
    announce("변수를 추가했습니다. 하단 문맥에서 편집하세요.");
  };
  const addFromBehaviorPalette = (paletteId: BehaviorPaletteId, position?: Point) => {
    if (paletteId === "variable") {
      addVariableFromPalette();
      return;
    }
    if (paletteId === "condition") {
      addConditionNode(position);
      return;
    }
    const mapped: Record<"situation" | "action" | "decision", DomainEntityKind> = {
      situation: "state",
      action: "action",
      decision: "decision",
    };
    addDomainNode(mapped[paletteId], position);
  };
  const addInterruptRule = (targetNodeId: string) => {
    const scopeId = activeScopeId ?? graph.rootScopeId;
    const anyNode = findScopeSystemNode(graphRef.current, "any", scopeId);
    const target = graphRef.current.nodes.find((node) => node.id === targetNodeId);
    if (!anyNode || !target || isSystemNode(target)) {
      announce("이동할 상황을 먼저 선택하세요.");
      return;
    }
    connectNodes(anyNode.id, target.id, { forceInterrupt: true });
    announce(`${ANYWHERE_INTERRUPT_LABEL} → ‘${target.name}’. ${FLOW_CONDITION_PROMPT}`);
  };
  const addExitReturnRule = (sourceNodeId: string) => {
    const scopeId = activeScopeId ?? graph.rootScopeId;
    const exitNode = findScopeSystemNode(graphRef.current, "exit", scopeId);
    const source = graphRef.current.nodes.find((node) => node.id === sourceNodeId);
    if (!exitNode || !source || isSystemNode(source)) {
      announce("종료할 상황을 선택하세요.");
      return;
    }
    connectNodes(source.id, exitNode.id);
    announce(`‘${source.name}’에서 종료/복귀 규칙을 추가했습니다.`);
  };
  const addSubmachine = (position?: Point) => {
    if (graph.mode === "bt") return;
    const parentScopeId = activeScopeId ?? getRootScope(graph)?.id;
    if (!parentScopeId) return;
    const result = createChildMachine(graphRef.current, parentScopeId, `행동 묶음 ${graph.scopes.length}`, position);
    if (!update(() => result.graph)) return;
    setSelectedNodeId(result.ownerNodeId);
    setSelectedEdgeId(undefined);
    announce("행동 묶음을 만들었습니다. 두 번 클릭해 들어갈 수 있습니다.");
  };
  const setDefaultState = (nodeId: string) => {
    const node = graphRef.current.nodes.find((item) => item.id === nodeId);
    if (!node?.scopeId || !["state", "submachine"].includes(node.kind)) return;
    update((current) => ({
      ...current,
      scopes: current.scopes.map((scope) => scope.id === node.scopeId ? { ...scope, initialNodeId: node.id } : scope),
      initialNodeId: current.rootScopeId === node.scopeId ? node.id : current.initialNodeId,
    }));
    announce(`‘${node.name}’을(를) 시작 상황으로 지정했습니다.`);
  };
  const deleteNodeById = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const result = deleteGraphNode(graphRef.current, nodeId);
    if (!update(() => result.graph)) return;
    setSelectedNodeId(result.selectedNodeId);
    setSelectedEdgeId(undefined);
    announce("노드와 연결된 전환을 삭제했습니다. Ctrl+Z로 되돌릴 수 있습니다.");
  };
  const openScope = (scopeId: string) => {
    if (!graph.scopes.some((scope) => scope.id === scopeId)) return;
    setActiveScopeId(scopeId);
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
    if (isCompactLayout()) setSidebarOpen(false);
    setViewportCommand((current) => ({ id: (current?.id ?? 0) + 1, type: "fit-all" }));
  };
  const connectNodes = (source: string, target: string, options?: { forceInterrupt?: boolean }) => {
    const currentGraph = graphRef.current;
    const link = classifyAuthoringLink(currentGraph, source, target);
    if (!link.ok && !options?.forceInterrupt) {
      announce(link.message);
      return;
    }
    if (currentGraph.edges.some((edge) => edge.source === source && edge.target === target)) {
      const existing = currentGraph.edges.find((edge) => edge.source === source && edge.target === target);
      if (existing) {
        setSelectedNodeId(undefined);
        setSelectedEdgeId(existing.id);
        announce("이미 같은 흐름이 있습니다. 조건을 편집하세요.");
      }
      return;
    }
    const edgeId = `${graph.mode}-edge-${crypto.randomUUID()}`;
    const promptCondition = Boolean(link.promptCondition || options?.forceInterrupt || link.kind === "interrupt");
    const isDecisionCandidate = link.kind === "decision-action";
    const triggerType: GraphEdge["triggerType"] = promptCondition && !isDecisionCandidate ? "condition" : "always";
    const interruptPolicy: GraphEdge["interruptPolicy"] = options?.forceInterrupt || link.kind === "interrupt" ? "immediate" : "after-action";
    update((current) => ({
      ...current,
      edges: [...current.edges, {
        id: edgeId,
        source,
        target,
        priority: current.edges.length,
        ...(graph.mode === "bt" ? {} : {
          triggerType,
          interruptPolicy,
          ...(promptCondition && !isDecisionCandidate
            ? { conditions: [{ id: crypto.randomUUID(), key: "", operator: "==" as const, value: "true" }] }
            : {}),
        }),
      }],
    }));
    setSelectedNodeId(undefined);
    setSelectedEdgeId(edgeId);
    if (link.message) announce(link.message);
  };

  const createContextVariable = (displayName: string, key?: string) => {
    const current = blackboardRef.current;
    const entry = createContextVariableEntry(displayName, {
      key,
      existingKeys: current.map((item) => item.key),
    });
    const next = [...current, entry];
    blackboardRef.current = next;
    updateBlackboard(next);
    announce(`문맥 값 ‘${entry.displayName ?? entry.key}’을(를) 만들었습니다.`);
    return entry;
  };
  const renameSelectedNode = (name: string) => selectedNodeId && update((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNodeId ? { ...node, name } : node) }));
  const updateSelectedNode = (nextNode: GraphNode) => update((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nextNode.id ? nextNode : node) }));
  const updateScope = (scopeId: string, patch: Partial<GraphDefinition["scopes"][number]>) => update((current) => ({ ...current, scopes: current.scopes.map((scope) => scope.id === scopeId ? { ...scope, ...patch } : scope) }));
  const updateSelectedEdge = (nextEdge: GraphEdge) => update((current) => ({ ...current, edges: current.edges.map((edge) => edge.id === nextEdge.id ? nextEdge : edge) }));
  const deleteSelectedEdge = (notify = true) => {
    if (!selectedEdgeId) return;
    const deleted = update((current) => deleteGraphEdge(current, selectedEdgeId));
    if (!deleted) return;
    setSelectedEdgeId(undefined);
    if (notify) announce("전환을 삭제했습니다. Ctrl+Z로 되돌릴 수 있습니다.");
  };
  const deleteSelectedNode = (notify = true) => {
    if (!selectedNodeId) return;
    const result = deleteGraphNode(graphRef.current, selectedNodeId);
    const deleted = update(() => result.graph);
    if (!deleted) return;
    setSelectedNodeId(result.selectedNodeId);
    setSelectedEdgeId(undefined);
    if (notify) announce("노드와 연결된 전환을 삭제했습니다. Ctrl+Z로 되돌릴 수 있습니다.");
  };
  const copySelectedNode = (notify = true) => {
    const source = graphRef.current.nodes.find((node) => node.id === selectedNodeId);
    if (!source) return false;
    clipboardNodeRef.current = { ...source, position: { ...source.position }, decorators: source.decorators ? [...source.decorators] : undefined };
    if (notify) announce(`‘${source.name}’ 노드를 복사했습니다.`);
    return true;
  };
  const pasteNode = () => {
    const source = clipboardNodeRef.current;
    if (!source) { announce("먼저 노드를 복사하세요."); return; }
    const result = duplicateGraphNode(graphRef.current, source);
    if (!update(() => result.graph)) return;
    setSelectedNodeId(result.selectedNodeId);
    setSelectedEdgeId(undefined);
    clipboardNodeRef.current = result.graph.nodes.find((node) => node.id === result.selectedNodeId);
    announce("노드를 붙여넣었습니다.");
  };
  const duplicateSelectedNode = () => {
    const source = graphRef.current.nodes.find((node) => node.id === selectedNodeId);
    if (!source) return;
    const result = duplicateGraphNode(graphRef.current, source);
    if (!update(() => result.graph)) return;
    setSelectedNodeId(result.selectedNodeId);
    setSelectedEdgeId(undefined);
    announce("노드를 복제했습니다.");
  };
  const undo = () => {
    const previous = undoStackRef.current.pop();
    if (!previous) { announce("되돌릴 변경이 없습니다."); return; }
    redoStackRef.current.push({ graph: graphRef.current, selectedNodeId, selectedEdgeId });
    graphRef.current = previous.graph;
    onGraphUpdate(previous.graph);
    setSelectedNodeId(previous.selectedNodeId);
    setSelectedEdgeId(previous.selectedEdgeId);
    announce("변경을 되돌렸습니다.");
  };
  const redo = () => {
    const next = redoStackRef.current.pop();
    if (!next) { announce("다시 실행할 변경이 없습니다."); return; }
    undoStackRef.current.push({ graph: graphRef.current, selectedNodeId, selectedEdgeId });
    graphRef.current = next.graph;
    onGraphUpdate(next.graph);
    setSelectedNodeId(next.selectedNodeId);
    setSelectedEdgeId(next.selectedEdgeId);
    announce("변경을 다시 실행했습니다.");
  };
  const frameGraph = (selectionOnly: boolean) => {
    setViewportCommand((current) => ({
      id: (current?.id ?? 0) + 1,
      type: selectionOnly && selectedNodeId ? "fit-selected" : "fit-all",
      nodeId: selectionOnly ? selectedNodeId : undefined,
    }));
  };
  const updateBlackboard = (blackboard: BlackboardEntry[]) => {
    const currentSet = setRef.current;
    blackboard.forEach((entry) => {
      const previous = currentSet.blackboard.find((item) => item.key === entry.key);
      if (previous?.liveValue !== entry.liveValue) runtimeRef.current?.setBlackboardValue(entry.key, entry.liveValue);
    });
    // Merge onto latest set + graphRef so in-flight graph edits are not wiped.
    const graphs = currentSet.graphs.map((item) => item.id === graphRef.current.id ? graphRef.current : item);
    const nextSet = touchSet({ ...currentSet, graphs, blackboard });
    setRef.current = nextSet;
    blackboardRef.current = blackboard;
    onSetUpdate(nextSet);
  };
  const updateCatalog = (actions: PatternSet["actions"], conditions: PatternSet["conditions"]) => onSetUpdate(touchSet({ ...setRef.current, actions, conditions }));
  const openDrawer = (tab: DrawerTab) => setDrawerTab((current) => current === tab ? undefined : tab);
  const exportPattern = async (target: "ir" | "diagnostics" | EngineExportTarget) => {
    const baseName = safeFileName(set.name);
    if (target === "ir") {
      downloadText(`${baseName}.pattern-ir.json`, serializePatternIr(set));
      return;
    }
    if (target === "diagnostics") {
      downloadText(`${baseName}.diagnostics.json`, JSON.stringify(createDiagnosticsReport(set), null, 2));
      return;
    }
    const { createEnginePackage } = await import("./adapters/enginePackage");
    const blob = await createEnginePackage(set, target);
    downloadBlob(`${baseName}.${target === "unity" ? "unity-upm" : "unreal-plugin"}.zip`, blob);
    announce(`${target === "unity" ? "Unity UPM" : "Unreal 플러그인"} 패키지를 만들었습니다.`);
  };

  const selectNode = (nodeId?: string) => {
    setSelectedNodeId(nodeId);
    if (nodeId) setSelectedEdgeId(undefined);
    if (nodeId && isCompactLayout()) setSidebarOpen(false);
  };
  const selectEdge = (edgeId?: string) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) setSelectedNodeId(undefined);
    if (edgeId && isCompactLayout()) setSidebarOpen(false);
  };
  const toggleSidebar = () => {
    setSidebarOpen((current) => {
      const next = !current;
      if (next && isCompactLayout()) {
        setSelectedNodeId(undefined);
        setSelectedEdgeId(undefined);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && shortcutHelpOpen) {
        event.preventDefault();
        setShortcutHelpOpen(false);
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifier && key === "f") {
        event.preventDefault();
        if (isCompactLayout()) {
          setSelectedNodeId(undefined);
          setSelectedEdgeId(undefined);
        }
        setSidebarOpen(true);
        window.setTimeout(() => (document.querySelector("[data-pattern-search]") as HTMLInputElement | null)?.focus(), 0);
        return;
      }
      if (modifier && key === "s") {
        event.preventDefault();
        onSetUpdate(touchSet({ ...set }));
        announce("현재 작업을 저장했습니다.");
        return;
      }
      if (modifier && key === "p") {
        event.preventDefault();
        if (event.altKey) { stepRuntime(); return; }
        if (event.shiftKey) {
          if (runtimeState === "stopped") { announce("먼저 시뮬레이션을 실행하세요."); return; }
          changeRuntimeState(runtimeState === "paused" ? "playing" : "paused");
          return;
        }
        changeRuntimeState(runtimeState === "stopped" ? "playing" : "stopped");
        return;
      }
      if (isEditableTarget(event.target)) return;

      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (modifier && key === "y") { event.preventDefault(); redo(); return; }
      if (modifier && key === "c") { event.preventDefault(); copySelectedNode(); return; }
      if (modifier && key === "x") {
        event.preventDefault();
        if (copySelectedNode(false)) { deleteSelectedNode(false); announce("노드를 잘라냈습니다."); }
        return;
      }
      if (modifier && key === "v") { event.preventDefault(); pasteNode(); return; }
      if (modifier && key === "d") { event.preventDefault(); duplicateSelectedNode(); return; }
      if ((event.key === "Delete" || (event.key === "Backspace" && event.shiftKey)) && !event.repeat) {
        event.preventDefault();
        if (selectedEdgeId) deleteSelectedEdge(); else if (selectedNodeId) deleteSelectedNode();
        return;
      }
      if (event.key === "F2" && selectedNodeId) {
        event.preventDefault();
        window.setTimeout(() => {
          const input = document.querySelector("[data-node-name-input]") as HTMLInputElement | null;
          input?.focus();
          input?.select();
        }, 0);
        return;
      }
      if (key === "f") { event.preventDefault(); frameGraph(!event.shiftKey); return; }
      if (event.key === "Escape") {
        setSelectedNodeId(undefined);
        setSelectedEdgeId(undefined);
        setDrawerTab(undefined);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="editor-app">
      <EditorChrome setName={set.name} graphName={graph.name} graphMode={graph.mode} runtimeState={runtimeState} runtimeEngine={runtimeSnapshot.engine} tick={runtimeSnapshot.tick} issueCount={issues.length} issueSummary={issues[0]?.message} sidebarOpen={sidebarOpen} onSidebarToggle={toggleSidebar} onRuntimeStateChange={changeRuntimeState} onStep={stepRuntime} onValidationOpen={() => openDrawer("validation")} onExport={exportPattern} onBackToLibrary={onBack} />
      <main className={`workbench-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${selectedNode || selectedEdge ? "inspector-open" : "inspector-closed"}`}>
        {sidebarOpen && <HierarchyPanel setName={set.name} graphs={set.graphs} graph={graph} selectedGraphId={selectedGraphId} selectedNodeId={selectedNodeId} activeScopeId={activeScopeId} onGraphChange={selectGraph} onGraphCreate={onGraphCreate} onGraphRename={onGraphRename} onGraphDuplicate={onGraphDuplicate} onGraphDelete={onGraphDelete} onNodeSelect={selectNode} onScopeOpen={openScope} />}
        <section className="canvas-column">
          <header className="document-header">
            <div className="document-path"><span>행동</span><ChevronRight size={13} /><strong>{graph.name}</strong>{graph.mode === "state-machine" && scopePath(graph, activeScopeId).map((scope) => <span className="scope-crumb" key={scope.id}><ChevronRight size={12} /><button onClick={() => openScope(scope.id)}>{scope.name}</button></span>)}<span className={`mode-badge mode-${graph.mode}`}>{modeLabel()}</span></div>
            <div className="document-status">
              <button
                className={issues.length ? "has-issues" : "is-valid"}
                onClick={() => openDrawer("validation")}
                title={issues.length ? issues.map((issue) => issue.message).join(" · ") : "구조 검증 통과"}
              >
                {issues.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                {issues.length
                  ? (issues.length === 1
                    ? issues[0]!.message
                    : `${issues.length}개 확인 필요 · ${issues[0]!.message}`)
                  : "구조 유효"}
              </button>
              {!selectedNode && !selectedEdge && <button onClick={() => selectNode(firstSelectableNodeId(graph, activeScopeId))}><PanelRightOpen size={14} />속성 열기</button>}
            </div>
          </header>
          <GraphEditor graph={graph} graphMode={graph.mode} scopeId={activeScopeId} selectedNodeId={selectedNodeId} selectedEdgeId={selectedEdgeId} activeNodeId={activeNodeId} runtimeState={runtimeState} runtimeNodeStates={runtimeSnapshot.nodeStates} onNodeSelect={selectNode} onEdgeSelect={selectEdge} onNodeMove={moveNode} onNodesLayout={layoutNodes} onNodeAdd={addNode} onDomainNodeAdd={addDomainNode} onBehaviorPaletteAdd={addFromBehaviorPalette} onSubmachineAdd={addSubmachine} onScopeOpen={openScope} onSetDefaultState={setDefaultState} onNodeDelete={deleteNodeById} onEdgeConnect={connectNodes} onConnectRejected={announce} onAddInterrupt={addInterruptRule} onAddExitReturn={addExitReturnRule} viewportCommand={viewportCommand} onShortcutHelp={() => setShortcutHelpOpen(true)} simulationActive={runtimeState !== "stopped" || drawerTab === "simulation"} blackboard={set.blackboard} />
          <BottomPanel activeTab={drawerTab} issues={issues} blackboard={set.blackboard} actions={set.actions} conditions={set.conditions} trace={runtimeSnapshot.trace} engine={runtimeSnapshot.engine} tick={runtimeSnapshot.tick} coverage={runtimeSnapshot.coverage} stateDurationsMs={runtimeSnapshot.stateDurationsMs} failedConditions={runtimeSnapshot.failedConditions} lastSignal={runtimeSnapshot.lastSignal} onBlackboardChange={updateBlackboard} onCatalogChange={updateCatalog} onEventSend={sendRuntimeEvent} onSeek={seekRuntime} onTabChange={openDrawer} selectedNode={selectedNode} graph={graph} nameLookup={Object.fromEntries(graph.nodes.map((n) => [n.id, n.name]))} simulationActive={runtimeState !== "stopped" || drawerTab === "simulation"} onClose={() => setDrawerTab(undefined)} />
        </section>
        {selectedNode && <InspectorPanel graph={graph} graphMode={graph.mode} selectedNode={selectedNode} actionDefinitions={set.actions} runtimeState={runtimeState} runtimeNodeState={runtimeSnapshot.nodeStates[selectedNode.id]} onNodeNameChange={renameSelectedNode} onNodeChange={updateSelectedNode} onScopeChange={updateScope} onSetDefaultState={setDefaultState} onScopeOpen={openScope} onNodeDelete={() => deleteSelectedNode()} onTransitionSelect={selectEdge} onClose={() => selectNode(undefined)} />}
        {selectedEdge && <TransitionInspectorPanel graph={graph} edge={selectedEdge} blackboard={set.blackboard} onChange={updateSelectedEdge} onDelete={() => deleteSelectedEdge()} onClose={() => selectEdge(undefined)} onCreateContextVariable={createContextVariable} />}
      </main>
      {createDialog}
      {shortcutHelpOpen && <ShortcutHelpDialog onClose={() => setShortcutHelpOpen(false)} />}
      {commandNotice && <div className="command-notice" role="status">{commandNotice}</div>}
    </div>
  );
}

interface GraphHistoryEntry {
  graph: GraphDefinition;
  selectedNodeId?: string;
  selectedEdgeId?: string;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isCompactLayout(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 760
    || (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 760px)").matches);
}

function graphHasRunnableSituations(graph: GraphDefinition): boolean {
  return graph.nodes.some((node) => !isSystemNode(node) && (node.kind === "state" || node.kind === "submachine" || node.kind === "task" || node.kind === "selector"));
}

function emptyRuntimeSnapshot(graph: GraphDefinition): PatternRuntimeSnapshot {
  return {
    engine: graph.mode === "bt" ? "Mistreevous" : "XState",
    state: "stopped",
    tick: 0,
    activeNodeId: undefined,
    activePath: [],
    coverage: {},
    stateDurationsMs: {},
    failedConditions: [],
    nodeStates: {},
    replay: [],
    trace: [],
  };
}

function createSnapshot(graph: GraphDefinition, blackboard: BlackboardEntry[] = []): PatternRuntimeSnapshot {
  // Empty Behavior (no situations yet) is a valid authoring state — skip runtime build.
  if (!graphHasRunnableSituations(graph)) {
    void blackboard;
    return emptyRuntimeSnapshot(graph);
  }
  const runtime = createPatternRuntime(graph, blackboard);
  const snapshot = runtime.getSnapshot();
  runtime.dispose();
  return snapshot;
}

function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "pattern-set";
}

function modeLabel(): string {
  return "행동 캔버스";
}


