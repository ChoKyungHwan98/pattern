import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, PanelRightOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { createChildMachine, getRootScope, scopePath } from "./editor/stateMachine";
import { createDiagnosticsReport } from "./editor/diagnostics";
import { publishPatternArtifacts } from "./editor/studioArtifact";
import { useScreenHistory } from "./editor/screenHistory";

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
  const graph = set.graphs.find((item) => item.id === selectedGraphId) ?? set.graphs[0];

  const addGraph = (mode: GraphMode, name: string) => {
    const newGraph = createGraph(mode, name);
    onChange(touchSet({ ...set, graphs: [...set.graphs, newGraph] }));
    setSelectedGraphId(newGraph.id);
    setCreateOpen(false);
  };

  const updateGraph = (nextGraph: GraphDefinition) => {
    const now = new Date().toISOString();
    onChange(touchSet({
      ...set,
      graphs: set.graphs.map((item) => item.id === nextGraph.id ? { ...nextGraph, updatedAt: now } : item),
    }));
  };
  const renameGraph = (graphId: string, name: string) => {
    onChange(touchSet({ ...set, graphs: set.graphs.map((item) => item.id === graphId ? { ...item, name, updatedAt: new Date().toISOString() } : item) }));
  };
  const duplicateGraph = (graphId: string) => {
    const source = set.graphs.find((item) => item.id === graphId);
    if (!source) return;
    const copy = duplicateGraphDefinition(source);
    onChange(touchSet({ ...set, graphs: [...set.graphs, copy] }));
    setSelectedGraphId(copy.id);
  };
  const deleteGraph = (graphId: string) => {
    const remaining = set.graphs.filter((item) => item.id !== graphId);
    onChange(touchSet({ ...set, graphs: remaining }));
    if (selectedGraphId === graphId) setSelectedGraphId(remaining[0]?.id);
  };

  if (!graph) {
    return (
      <div className="editor-app editor-empty-app">
        <header className="workbench-header empty-editor-header">
          <button className="back-to-library" onClick={onBack}><ArrowLeft size={16} /><span>세트 목록</span></button>
          <div className="header-document"><strong>{set.name}</strong><span>그래프 문서 0개</span></div>
        </header>
        <main className="workbench-shell sidebar-open inspector-closed">
          <HierarchyPanel setName={set.name} graphs={set.graphs} selectedGraphId={selectedGraphId} onGraphChange={setSelectedGraphId} onGraphCreate={() => setCreateOpen(true)} onNodeSelect={() => undefined} />
          <section className="empty-editor-canvas">
            <span><Plus size={23} /></span>
            <strong>첫 그래프를 만드세요.</strong>
            <p>이 세트에는 계층 상태 머신과 행동 트리를 필요한 만큼 추가할 수 있습니다.</p>
            <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={15} /> 새 그래프</button>
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
      onSetUpdate={onChange}
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(graph.initialNodeId ?? graph.rootNodeId ?? graph.nodes[0]?.id);
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
  useEffect(() => { blackboardRef.current = set.blackboard; }, [set.blackboard]);

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
    setSelectedNodeId(nextGraph?.initialNodeId ?? nextGraph?.rootNodeId ?? nextGraph?.nodes[0]?.id);
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
    setDrawerTab((current) => current ?? "trace");
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
    setDrawerTab("trace");
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
    onGraphUpdate(next);
    return true;
  };
  const moveNode = (nodeId: string, position: Point) => update((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, position } : node) }));
  const layoutNodes = (positions: Record<string, Point>) => update((current) => ({ ...current, nodes: current.nodes.map((node) => ({ ...node, position: positions[node.id] ?? node.position })) }));
  const addNode = (position?: Point) => {
    const index = graph.nodes.length + 1;
    const nodeId = `${graph.mode}-node-${crypto.randomUUID()}`;
    const scopeId = graph.mode === "bt" ? undefined : activeScopeId ?? graph.rootScopeId;
    update((current) => ({
      ...current,
      nodes: [...current.nodes, { id: nodeId, name: graph.mode === "bt" ? `새 행동 ${index}` : `새 상태 ${index}`, kind: graph.mode === "bt" ? "task" : "state", scopeId, position: position ?? { x: 180 + index * 22, y: 160 + index * 18 }, subtitle: graph.mode === "bt" ? "행동" : "상태" }],
      scopes: current.scopes.map((scope) => scope.id === scopeId && !scope.initialNodeId ? { ...scope, initialNodeId: nodeId } : scope),
      initialNodeId: current.rootScopeId === scopeId && !current.initialNodeId ? nodeId : current.initialNodeId,
    }));
    setSelectedNodeId(nodeId);
  };
  const addSubmachine = (position?: Point) => {
    if (graph.mode === "bt") return;
    const parentScopeId = activeScopeId ?? getRootScope(graph)?.id;
    if (!parentScopeId) return;
    const result = createChildMachine(graphRef.current, parentScopeId, `하위 상태 머신 ${graph.scopes.length}`, position);
    if (!update(() => result.graph)) return;
    setSelectedNodeId(result.ownerNodeId);
    setSelectedEdgeId(undefined);
    announce("하위 상태 머신을 만들었습니다. 두 번 클릭해 들어갈 수 있습니다.");
  };
  const setDefaultState = (nodeId: string) => {
    const node = graphRef.current.nodes.find((item) => item.id === nodeId);
    if (!node?.scopeId || !["state", "submachine"].includes(node.kind)) return;
    update((current) => ({
      ...current,
      scopes: current.scopes.map((scope) => scope.id === node.scopeId ? { ...scope, initialNodeId: node.id } : scope),
      initialNodeId: current.rootScopeId === node.scopeId ? node.id : current.initialNodeId,
    }));
    announce(`‘${node.name}’을(를) 기본 상태로 지정했습니다.`);
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
  const connectNodes = (source: string, target: string) => {
    const edgeId = `${graph.mode}-edge-${crypto.randomUUID()}`;
    update((current) => current.edges.some((edge) => edge.source === source && edge.target === target) ? current : ({
      ...current,
      edges: [...current.edges, {
        id: edgeId,
        source,
        target,
        priority: current.edges.length,
        ...(graph.mode === "bt" ? {} : { triggerType: "always" as const, interruptPolicy: "after-action" as const }),
      }],
    }));
    setSelectedNodeId(undefined);
    setSelectedEdgeId(edgeId);
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
    blackboard.forEach((entry) => {
      const previous = set.blackboard.find((item) => item.key === entry.key);
      if (previous?.liveValue !== entry.liveValue) runtimeRef.current?.setBlackboardValue(entry.key, entry.liveValue);
    });
    onSetUpdate(touchSet({ ...set, blackboard }));
  };
  const updateCatalog = (actions: PatternSet["actions"], conditions: PatternSet["conditions"]) => onSetUpdate(touchSet({ ...set, actions, conditions }));
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
      <EditorChrome setName={set.name} graphName={graph.name} graphMode={graph.mode} runtimeState={runtimeState} runtimeEngine={runtimeSnapshot.engine} tick={runtimeSnapshot.tick} issueCount={issues.length} sidebarOpen={sidebarOpen} onSidebarToggle={toggleSidebar} onRuntimeStateChange={changeRuntimeState} onStep={stepRuntime} onValidationOpen={() => openDrawer("validation")} onExport={exportPattern} onBackToLibrary={onBack} />
      <main className={`workbench-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${selectedNode || selectedEdge ? "inspector-open" : "inspector-closed"}`}>
        {sidebarOpen && <HierarchyPanel setName={set.name} graphs={set.graphs} graph={graph} selectedGraphId={selectedGraphId} selectedNodeId={selectedNodeId} activeScopeId={activeScopeId} onGraphChange={selectGraph} onGraphCreate={onGraphCreate} onGraphRename={onGraphRename} onGraphDuplicate={onGraphDuplicate} onGraphDelete={onGraphDelete} onNodeSelect={selectNode} onScopeOpen={openScope} />}
        <section className="canvas-column">
          <header className="document-header">
            <div className="document-path"><span>그래프</span><ChevronRight size={13} /><strong>{graph.name}</strong>{graph.mode === "state-machine" && scopePath(graph, activeScopeId).map((scope) => <span className="scope-crumb" key={scope.id}><ChevronRight size={12} /><button onClick={() => openScope(scope.id)}>{scope.name}</button></span>)}<span className={`mode-badge mode-${graph.mode}`}>{modeLabel(graph.mode)}</span></div>
            <div className="document-status">
              <button className={issues.length ? "has-issues" : "is-valid"} onClick={() => openDrawer("validation")}>{issues.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}{issues.length ? `${issues.length}개 확인 필요` : "구조 유효"}</button>
              {!selectedNode && !selectedEdge && <button onClick={() => selectNode(graph.nodes[0]?.id)}><PanelRightOpen size={14} />속성 열기</button>}
            </div>
          </header>
          <GraphEditor graph={graph} graphMode={graph.mode} scopeId={activeScopeId} selectedNodeId={selectedNodeId} selectedEdgeId={selectedEdgeId} activeNodeId={activeNodeId} runtimeState={runtimeState} runtimeNodeStates={runtimeSnapshot.nodeStates} onNodeSelect={selectNode} onEdgeSelect={selectEdge} onNodeMove={moveNode} onNodesLayout={layoutNodes} onNodeAdd={addNode} onSubmachineAdd={addSubmachine} onScopeOpen={openScope} onSetDefaultState={setDefaultState} onNodeDelete={deleteNodeById} onEdgeConnect={connectNodes} viewportCommand={viewportCommand} onShortcutHelp={() => setShortcutHelpOpen(true)} />
          <BottomPanel activeTab={drawerTab} issues={issues} blackboard={set.blackboard} actions={set.actions} conditions={set.conditions} trace={runtimeSnapshot.trace} engine={runtimeSnapshot.engine} tick={runtimeSnapshot.tick} coverage={runtimeSnapshot.coverage} stateDurationsMs={runtimeSnapshot.stateDurationsMs} failedConditions={runtimeSnapshot.failedConditions} lastSignal={runtimeSnapshot.lastSignal} onBlackboardChange={updateBlackboard} onCatalogChange={updateCatalog} onEventSend={sendRuntimeEvent} onSeek={seekRuntime} onTabChange={openDrawer} onClose={() => setDrawerTab(undefined)} />
        </section>
        {selectedNode && <InspectorPanel graph={graph} graphMode={graph.mode} selectedNode={selectedNode} actionDefinitions={set.actions} runtimeState={runtimeState} runtimeNodeState={runtimeSnapshot.nodeStates[selectedNode.id]} onNodeNameChange={renameSelectedNode} onNodeChange={updateSelectedNode} onScopeChange={updateScope} onSetDefaultState={setDefaultState} onScopeOpen={openScope} onNodeDelete={() => deleteSelectedNode()} onTransitionSelect={selectEdge} onClose={() => selectNode(undefined)} />}
        {selectedEdge && <TransitionInspectorPanel graph={graph} edge={selectedEdge} blackboard={set.blackboard} onChange={updateSelectedEdge} onDelete={() => deleteSelectedEdge()} onClose={() => selectEdge(undefined)} />}
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

function createSnapshot(graph: GraphDefinition, blackboard: BlackboardEntry[] = []): PatternRuntimeSnapshot {
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

function modeLabel(mode: GraphMode): string {
  return mode === "bt" ? "행동 트리" : "상태 머신";
}
