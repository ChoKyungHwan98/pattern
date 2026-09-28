import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlignHorizontalDistributeCenter,
  ChevronDown,
  Boxes,
  Hand,
  Keyboard,
  LocateFixed,
  MousePointer2,
  Plus,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DomainEntityKind } from "../editor/domain";
import {
  BEHAVIOR_PALETTE,
  canvasNodeBadge,
  canvasNodeKindName,
  decisionCanvasBrief,
  isDecisionCandidateEdge,
  exitReturnEdges,
  findScopeSystemNode,
  interruptEdges,
  isCanvasVisibleNode,
  situationNodesInScope,
  type BehaviorPaletteId,
} from "../editor/behaviorUi";
import {
  ANYWHERE_INTERRUPT_LABEL,
  FIRST_SITUATION_CTA,
  classifyAuthoringLink,
  isBehaviorCanvasEmpty,
} from "../editor/authoringFlow";
import type {
  BlackboardEntry,
  GraphDefinition,
  GraphMode,
  GraphNode,
  Point,
  RuntimeState,
} from "../editor/model";
import { summarizeTransition } from "../editor/transitionSemantics";
import { evaluateDecision } from "../editor/utilitySimulation";
import { isSystemNode } from "../editor/stateMachine";
import type { RuntimeNodeState } from "../runtime/types";

interface GraphEditorProps {
  graph: GraphDefinition;
  graphMode: GraphMode;
  scopeId?: string;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  activeNodeId?: string;
  runtimeState: RuntimeState;
  runtimeNodeStates: Record<string, RuntimeNodeState>;
  onNodeSelect: (nodeId?: string) => void;
  onEdgeSelect: (edgeId?: string) => void;
  onNodeMove: (nodeId: string, position: Point) => void;
  onNodesLayout: (positions: Record<string, Point>) => void;
  onNodeAdd: (position?: Point) => void;
  onDomainNodeAdd?: (entityKind: DomainEntityKind, position?: Point) => void;
  onBehaviorPaletteAdd?: (paletteId: BehaviorPaletteId, position?: Point) => void;
  onSubmachineAdd: (position?: Point) => void;
  onScopeOpen: (scopeId: string) => void;
  onSetDefaultState: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeConnect: (source: string, target: string) => void;
  /** Called when a drag-connect is rejected by authoring rules. */
  onConnectRejected?: (message: string) => void;
  onAddInterrupt?: (targetNodeId: string) => void;
  onAddExitReturn?: (sourceNodeId: string) => void;
  viewportCommand?: GraphViewportCommand;
  onShortcutHelp: () => void;
  /** When true, emphasize selected Decision→Action edge; scores stay in Decision Trace panel only. */
  simulationActive?: boolean;
  blackboard?: BlackboardEntry[];
}

export interface GraphViewportCommand {
  id: number;
  type: "fit-all" | "fit-selected";
  nodeId?: string;
}

type StateNodeData = {
  node: GraphNode;
  runtimeState: RuntimeNodeState;
  nameLookup: Record<string, string>;
  decisionTrace?: ReturnType<typeof evaluateDecision>;
  simulationActive?: boolean;
};

type StateFlowNode = Node<StateNodeData, "patternState">;
type PatternFlowNode = StateFlowNode;

const nodeWidth = 190;
const nodeHeight = 70;

const nodeTypes = {
  patternState: PatternStateNode,
};

export function GraphEditor(props: GraphEditorProps) {
  return (
    <ReactFlowProvider>
      <GraphEditorCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphEditorCanvas({
  graph,
  graphMode,
  scopeId,
  selectedNodeId,
  selectedEdgeId,
  activeNodeId,
  runtimeState,
  runtimeNodeStates,
  onNodeSelect,
  onEdgeSelect,
  onNodeMove,
  onNodesLayout,
  onNodeAdd,
  onDomainNodeAdd,
  onBehaviorPaletteAdd,
  onSubmachineAdd,
  onScopeOpen,
  onSetDefaultState,
  onNodeDelete,
  onEdgeConnect,
  onConnectRejected,
  onAddInterrupt,
  onAddExitReturn,
  viewportCommand,
  onShortcutHelp,
  simulationActive = false,
  blackboard = [],
}: GraphEditorProps) {
  const addFromPalette = (paletteId: BehaviorPaletteId, position?: Point) => {
    if (onBehaviorPaletteAdd) {
      onBehaviorPaletteAdd(paletteId, position);
      return;
    }
    if (paletteId === "variable") return;
    if (paletteId === "condition") {
      onNodeAdd(position);
      return;
    }
    const mapped: Record<"situation" | "action" | "decision", DomainEntityKind> = {
      situation: "state",
      action: "action",
      decision: "decision",
    };
    (onDomainNodeAdd ?? ((_, pos) => onNodeAdd(pos)))(mapped[paletteId], position);
  };
  const [tool, setTool] = useState<"select" | "pan" | "connect">("select");
  const [zoom, setZoom] = useState(0.9);
  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow<PatternFlowNode>();
  const lastViewportCommandRef = useRef<number | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; position: Point; nodeId?: string }>();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const nodes = useMemo(
    () => toFlowNodes(graph, scopeId, selectedNodeId, activeNodeId, runtimeState, runtimeNodeStates, simulationActive, blackboard),
    [activeNodeId, graph, runtimeNodeStates, runtimeState, scopeId, selectedNodeId, simulationActive, blackboard],
  );
  const edges = useMemo(() => toFlowEdges(graph, scopeId, selectedEdgeId, simulationActive, blackboard), [graph, scopeId, selectedEdgeId, simulationActive, blackboard]);

  useEffect(() => {
    if (!viewportCommand) return;
    if (lastViewportCommandRef.current === viewportCommand.id) return;
    lastViewportCommandRef.current = viewportCommand.id;
    const commandNodes = viewportCommand.type === "fit-selected"
      ? nodes.filter((node) => node.id === viewportCommand.nodeId)
      : undefined;
    if (viewportCommand.type === "fit-selected" && !commandNodes?.length) return;
    void fitView({ nodes: commandNodes, padding: viewportCommand.type === "fit-selected" ? 0.65 : 0.14, duration: 220 });
  }, [fitView, nodes, viewportCommand]);

  return (
    <div className="graph-editor">
      <div className="graph-toolbar">
        <button
          className={tool === "select" ? "active" : ""}
          aria-label="선택"
          title="선택"
          onClick={() => setTool("select")}
        >
          <MousePointer2 size={14} />
        </button>
        <button
          className={tool === "pan" ? "active" : ""}
          aria-label="화면 이동"
          title="화면 이동"
          onClick={() => setTool("pan")}
        >
          <Hand size={14} />
        </button>
        <span className="toolbar-divider" />
        <div className="domain-create-menu">
          <button onClick={() => setCreateMenuOpen((open) => !open)} aria-expanded={createMenuOpen} aria-haspopup="menu" aria-label="행동 요소 추가">
            <Plus size={14} />
            <span className="toolbar-label">요소 추가</span>
            <ChevronDown size={11} />
          </button>
          {createMenuOpen && (
            <div className="domain-create-dropdown behavior-palette-dropdown" role="menu">
              {BEHAVIOR_PALETTE.map((item) => (
                <button
                  key={item.id}
                  role="menuitem"
                  aria-label={item.label}
                  className="behavior-palette-item"
                  onClick={() => { addFromPalette(item.id); setCreateMenuOpen(false); }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.shortDescription}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        {graphMode === "state-machine" && (
          <button onClick={() => onSubmachineAdd()} title="중첩된 행동 묶음을 만듭니다. 더블클릭으로 들어갈 수 있습니다.">
            <Boxes size={14} />
            <span className="toolbar-label">행동 묶음</span>
          </button>
        )}
        <button
          className={tool === "connect" ? "active" : ""}
          onClick={() => setTool(tool === "connect" ? "select" : "connect")}
        >
          <Waypoints size={14} />
          <span className="toolbar-label">흐름 연결</span>
        </button>
        <button onClick={() => onNodesLayout(layoutGraph(graph, scopeId))}>
          <AlignHorizontalDistributeCenter size={14} />
          <span className="toolbar-label">자동 배치</span>
        </button>
        <span className="graph-toolbar-spacer" />
        <span className="graph-hint">캐릭터 행동 흐름을 연결하세요</span>
        <button className="shortcut-help-button" onClick={onShortcutHelp} title="편집기 단축키">
          <Keyboard size={14} />
          <span className="toolbar-label">단축키</span>
        </button>
      </div>

      <BehaviorScopeBar
        graph={graph}
        graphMode={graphMode}
        scopeId={scopeId}
        selectedNodeId={selectedNodeId}
        onSetDefaultState={onSetDefaultState}
        onEdgeSelect={onEdgeSelect}
        onEdgeConnect={onEdgeConnect}
        onConnectRejected={onConnectRejected}
        onAddInterrupt={onAddInterrupt}
        onAddExitReturn={onAddExitReturn}
      />

      <div className={`graph-viewport tool-${tool}`}>
        <ReactFlow<PatternFlowNode, Edge>
          className="pattern-flow"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 24, y: 18, zoom: 0.9 }}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          nodesDraggable={tool === "select"}
          nodesConnectable={tool !== "pan"}
          elementsSelectable={tool !== "pan"}
          panOnDrag={tool === "pan"}
          selectionOnDrag={tool === "select"}
          deleteKeyCode={null}
          onPaneClick={() => { setContextMenu(undefined); setCreateMenuOpen(false); onNodeSelect(undefined); onEdgeSelect(undefined); }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ x: event.clientX, y: event.clientY, position: screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
          }}
          onNodeClick={(_, node) => {
            if (node.type !== "patternState") return;
            if (tool === "connect" && selectedNodeId && selectedNodeId !== node.id) {
              const result = classifyAuthoringLink(graph, selectedNodeId, node.id);
              if (!result.ok) {
                onConnectRejected?.(result.message);
                return;
              }
              onEdgeConnect(selectedNodeId, node.id);
              setTool("select");
              return;
            }
            onEdgeSelect(undefined);
            onNodeSelect(node.id);
          }}
          onNodeDoubleClick={(_, flowNode) => {
            const source = graph.nodes.find((node) => node.id === flowNode.id);
            if (source?.kind === "submachine" && source.childScopeId) onScopeOpen(source.childScopeId);
          }}
          onNodeContextMenu={(event, flowNode) => {
            event.preventDefault();
            onNodeSelect(flowNode.id);
            setContextMenu({ x: event.clientX, y: event.clientY, position: flowNode.position, nodeId: flowNode.id });
          }}
          onEdgeClick={(_, edge) => { onNodeSelect(undefined); onEdgeSelect(edge.id); }}
          onNodeDragStop={(_, node) => {
            if (node.type !== "patternState") return;
            onNodeMove(node.id, absolutePosition(node));
          }}
          onConnect={(connection: Connection) => {
            if (!connection.source || !connection.target || connection.source === connection.target) return;
            const result = classifyAuthoringLink(graph, connection.source, connection.target);
            if (!result.ok) {
              onConnectRejected?.(result.message);
              return;
            }
            onEdgeConnect(connection.source, connection.target);
          }}
          isValidConnection={(connection) => {
            if (!connection.source || !connection.target || connection.source === connection.target) return false;
            return classifyAuthoringLink(graph, connection.source, connection.target).ok;
          }}
          onMove={(_, viewport) => setZoom(viewport.zoom)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#34383d" gap={16} size={1} variant={BackgroundVariant.Dots} />
          <MiniMap
            className="graph-minimap flow-minimap"
            pannable
            zoomable
            nodeColor={(node) => {
              return node.id === activeNodeId ? "#4cc2ff" : "#586169";
            }}
            maskColor="rgb(18 20 23 / 72%)"
          />
        </ReactFlow>

        {isBehaviorCanvasEmpty(graph, scopeId) && (
          <div className="behavior-empty-cta" role="region" aria-label={FIRST_SITUATION_CTA.title}>
            <strong>{FIRST_SITUATION_CTA.headline}</strong>
            <p>{FIRST_SITUATION_CTA.body}</p>
            <button
              type="button"
              className="primary-button"
              data-testid="first-situation-cta"
              onClick={() => addFromPalette("situation")}
            >
              <Plus size={15} /> {FIRST_SITUATION_CTA.buttonLabel}
            </button>
            <p className="behavior-empty-hint">또는 위 「요소 추가」에서 상황·행동·판단을 고를 수 있습니다.</p>
          </div>
        )}

        <div className="canvas-controls">
          <button aria-label="확대" title="확대" onClick={() => void zoomIn()}>
            <ZoomIn size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="축소" title="축소" onClick={() => void zoomOut()}>
            <ZoomOut size={14} />
          </button>
          <button
            aria-label="전체 보기"
            title="전체 보기"
            onClick={() => void fitView({ padding: 0.14, duration: 220 })}
          >
            <LocateFixed size={14} />
          </button>
        </div>
        {contextMenu && (
          <div className="graph-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(undefined)}>
            {contextMenu.nodeId ? (
              <>
                {graph.nodes.find((node) => node.id === contextMenu.nodeId)?.kind === "submachine" && <button onClick={() => { const scope = graph.nodes.find((node) => node.id === contextMenu.nodeId)?.childScopeId; if (scope) onScopeOpen(scope); setContextMenu(undefined); }}>행동 묶음 열기</button>}
                {["state", "submachine"].includes(graph.nodes.find((node) => node.id === contextMenu.nodeId)?.kind ?? "") && <button onClick={() => { onSetDefaultState(contextMenu.nodeId!); setContextMenu(undefined); }}>시작 상황으로 지정</button>}
                <button onClick={() => { setTool("connect"); setContextMenu(undefined); }}>이 요소에서 흐름 만들기</button>
                {!(["entry", "any", "exit"].includes(graph.nodes.find((node) => node.id === contextMenu.nodeId)?.kind ?? "")) && <button className="danger" onClick={() => { onNodeDelete(contextMenu.nodeId!); setContextMenu(undefined); }}>삭제</button>}
              </>
            ) : (
              <>
                {BEHAVIOR_PALETTE.map((item) => (
                  <button key={item.id} onClick={() => { addFromPalette(item.id, contextMenu.position); setContextMenu(undefined); }}>
                    {item.label} 만들기
                  </button>
                ))}
                {graphMode === "state-machine" && <button onClick={() => { onSubmachineAdd(contextMenu.position); setContextMenu(undefined); }}>행동 묶음 만들기</button>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PatternStateNode({ data, selected }: NodeProps<StateFlowNode>) {
  const { node, runtimeState, nameLookup, decisionTrace, simulationActive } = data;
  const kindName = canvasNodeKindName(node);
  const decisionBrief = decisionCanvasBrief(node, (id) => nameLookup[id] ?? id);
  const entityClass = node.domain?.entityKind ? `entity-${node.domain.entityKind}` : "";
  const subtitle = node.subtitle && !["State", "Action", "Decision"].includes(node.subtitle)
    ? node.subtitle
    : kindName;
  // PR5 fix: do NOT dump per-candidate scores on canvas nodes — only a compact pick hint.
  const pickHint = simulationActive && decisionTrace
    ? (decisionTrace.selectedActionName
      ? `시뮬 선택 → ${decisionTrace.selectedActionName}`
      : "시뮬 · 선택 후보 없음")
    : undefined;
  return (
    <div
      className={`graph-node kind-${node.kind} ${entityClass} ${decisionBrief ? "has-decision-brief" : ""} ${selected ? "selected" : ""} runtime-${runtimeState}`}
    >
      <Handle className="node-port input" type="target" position={Position.Top} />
      <span className="node-kind">{canvasNodeBadge(node)}</span>
      <strong>{node.name}</strong>
      <small>{pickHint ?? (decisionBrief ? decisionBrief.headline : subtitle)}</small>
      {decisionBrief && decisionBrief.lines.length > 0 && !simulationActive && (
        <ul className="decision-brief-list" aria-label="판단 후보">
          {decisionBrief.lines.slice(0, 3).map((line) => (
            <li key={line}>{line}</li>
          ))}
          {decisionBrief.lines.length > 3 && (
            <li className="decision-brief-more">외 {decisionBrief.lines.length - 3}개</li>
          )}
        </ul>
      )}
      {node.decorators && node.decorators.length > 0 && (
        <span className="node-decorator-count">{node.decorators.length}</span>
      )}
      <Handle className="node-port output" type="source" position={Position.Bottom} />
    </div>
  );
}

function toFlowNodes(
  graph: GraphDefinition,
  scopeId: string | undefined,
  selectedNodeId: string | undefined,
  activeNodeId: string | undefined,
  runtimeState: RuntimeState,
  runtimeNodeStates: Record<string, RuntimeNodeState>,
  simulationActive: boolean,
  blackboard: BlackboardEntry[],
): PatternFlowNode[] {
  const visibleScopeId = graph.mode === "bt" ? undefined : scopeId ?? graph.rootScopeId;
  const nameLookup = Object.fromEntries(graph.nodes.map((item) => [item.id, item.name]));
  const decisionTraces = simulationActive
    ? Object.fromEntries(
        graph.nodes
          .filter((node) => node.domain?.entityKind === "decision" || node.kind === "selector")
          .map((node) => [node.id, evaluateDecision(node, blackboard, (id) => nameLookup[id] ?? id)]),
      )
    : {};
  return graph.nodes
    .filter((node) => isCanvasVisibleNode(node))
    .filter((node) => graph.mode === "bt" || node.scopeId === visibleScopeId)
    .map((node): StateFlowNode => {
      const brief = decisionCanvasBrief(node, (id) => nameLookup[id] ?? id);
      // Sim mode: compact pick hint only — no per-candidate score rows on the node.
      const lineCount = simulationActive ? 0 : (brief?.lines.length ?? 0);
      const height = lineCount > 0
        ? Math.min(148, nodeHeight + 18 + lineCount * 14)
        : nodeHeight;
      return {
        id: node.id,
        type: "patternState",
        position: node.position,
        selected: selectedNodeId === node.id,
        data: {
          node,
          nameLookup,
          decisionTrace: decisionTraces[node.id],
          simulationActive,
          runtimeState:
            activeNodeId === node.id && runtimeState !== "stopped"
              ? runtimeNodeStates[node.id] === "running"
                ? "running"
                : "active"
              : runtimeNodeStates[node.id] ?? "ready",
        },
        style: { width: nodeWidth, height },
      };
    });
}

function toFlowEdges(
  graph: GraphDefinition,
  scopeId: string | undefined,
  selectedEdgeId: string | undefined,
  simulationActive = false,
  blackboard: BlackboardEntry[] = [],
): Edge[] {
  const visibleIds = new Set(graph.nodes
    .filter((node) => isCanvasVisibleNode(node))
    .filter((node) => graph.mode === "bt" || node.scopeId === (scopeId ?? graph.rootScopeId))
    .map((node) => node.id));
  const nameLookup = Object.fromEntries(graph.nodes.map((item) => [item.id, item.name]));
  /** Decision id → selected action node id when sim/trace is active. */
  const selectedActionByDecision: Record<string, string | null> = {};
  if (simulationActive) {
    for (const node of graph.nodes) {
      if (node.domain?.entityKind !== "decision" && node.kind !== "selector") continue;
      const trace = evaluateDecision(node, blackboard, (id) => nameLookup[id] ?? id);
      const winner = trace?.candidates.find((c) => c.selected);
      selectedActionByDecision[node.id] = winner?.actionNodeId ?? null;
    }
  }
  return graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map((edge) => {
    const selected = edge.id === selectedEdgeId;
    const candidateLink = graph.mode !== "bt" && isDecisionCandidateEdge(graph, edge);
    const simWinner = simulationActive && candidateLink
      ? selectedActionByDecision[edge.source] === edge.target
      : false;
    const simDim = simulationActive && candidateLink && !simWinner;
    const stroke = candidateLink
      ? (simWinner ? "#6ee7b0" : selected ? "#5ec8a0" : simDim ? "#2f4a3d" : "#4a9a78")
      : edge.accent === "success" ? "#6ca887" : edge.accent === "warning" ? "#b28a4b" : "#66737a";
    const label = graph.mode === "bt"
      ? edge.label
      : candidateLink
        ? (simWinner ? "선택" : undefined)
        : summarizeTransition(edge);
    const classNames = [
      "graph-edge",
      candidateLink ? "candidate-link" : (edge.accent ?? "normal"),
      simWinner ? "candidate-selected" : "",
      simDim ? "candidate-dimmed" : "",
    ].filter(Boolean).join(" ");
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label,
      type: "smoothstep",
      className: classNames,
      selected,
      markerEnd: { type: MarkerType.ArrowClosed, color: selected || simWinner ? (simWinner ? "#6ee7b0" : "#4cc2ff") : stroke },
      style: {
        stroke: selected && !simWinner ? "#4cc2ff" : stroke,
        strokeWidth: simWinner ? 2.8 : selected ? 2.2 : candidateLink ? (simDim ? 1.1 : 1.6) : 1.4,
        strokeDasharray: candidateLink ? (simWinner ? undefined : "6 4") : undefined,
        opacity: simDim ? 0.35 : 1,
      },
      labelStyle: { fill: simWinner ? "#b7f5d4" : selected ? "#dff5ff" : "#aeb5ba", fontSize: 12, fontWeight: simWinner ? 700 : 400 },
      labelBgStyle: { fill: simWinner ? "#0f2e22" : selected ? "#12384a" : "#1b1e22", fillOpacity: 0.96 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 2,
    };
  });
}
function absolutePosition(node: PatternFlowNode): Point {
  return node.position;
}

function layoutGraph(graph: GraphDefinition, scopeId?: string): Record<string, Point> {
  const positions: Record<string, Point> = {};
  const currentNodes = graph.nodes
    .filter((node) => isCanvasVisibleNode(node))
    .filter((node) => graph.mode === "bt" || node.scopeId === (scopeId ?? graph.rootScopeId));
  Object.assign(positions, runDagre(graph, currentNodes, graph.mode === "bt" ? "TB" : "LR"));
  return positions;
}

function runDagre(
  graph: GraphDefinition,
  nodes: GraphNode[],
  rankDirection: "TB" | "LR",
): Record<string, Point> {
  if (nodes.length === 0) return {};
  const ids = new Set(nodes.map((node) => node.id));
  const layout = new dagre.graphlib.Graph();
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({
    rankdir: rankDirection,
    nodesep: 54,
    ranksep: 88,
    marginx: 24,
    marginy: 24,
  });
  nodes.forEach((node) => layout.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
  graph.edges.forEach((edge) => {
    if (ids.has(edge.source) && ids.has(edge.target)) layout.setEdge(edge.source, edge.target);
  });
  dagre.layout(layout);

  return Object.fromEntries(
    nodes.map((node) => {
      const position = layout.node(node.id);
      return [
        node.id,
        {
          x: Math.max(8, position.x - nodeWidth / 2),
          y: Math.max(8, position.y - nodeHeight / 2),
        },
      ];
    }),
  );
}

function BehaviorScopeBar({
  graph,
  graphMode,
  scopeId,
  selectedNodeId,
  onSetDefaultState,
  onEdgeSelect,
  onEdgeConnect,
  onConnectRejected,
  onAddInterrupt,
  onAddExitReturn,
}: {
  graph: GraphDefinition;
  graphMode: GraphMode;
  scopeId?: string;
  selectedNodeId?: string;
  onSetDefaultState: (nodeId: string) => void;
  onEdgeSelect: (edgeId?: string) => void;
  onEdgeConnect: (source: string, target: string) => void;
  onConnectRejected?: (message: string) => void;
  onAddInterrupt?: (targetNodeId: string) => void;
  onAddExitReturn?: (sourceNodeId: string) => void;
}) {
  if (graphMode !== "state-machine") {
    return (
      <div className="behavior-scope-bar" aria-label="행동 범위">
        <span className="behavior-scope-label">행동 의도</span>
        <strong>트리 형태로 행동을 조합합니다</strong>
      </div>
    );
  }

  const scope = scopeId ?? graph.rootScopeId;
  const situations = situationNodesInScope(graph, scope);
  const startId = graph.scopes.find((item) => item.id === scope)?.initialNodeId
    ?? (scope === graph.rootScopeId ? graph.initialNodeId : undefined);
  const interrupts = interruptEdges(graph, scope);
  const exits = exitReturnEdges(graph, scope);
  const hasAny = Boolean(findScopeSystemNode(graph, "any", scope));
  const hasExit = Boolean(findScopeSystemNode(graph, "exit", scope));

  return (
    <div className="behavior-scope-bar" aria-label="행동 범위 속성">
      <label className="behavior-scope-field">
        <span>시작 상황</span>
        <select
          aria-label="시작 상황"
          value={startId ?? ""}
          onChange={(event) => {
            if (event.target.value) onSetDefaultState(event.target.value);
          }}
        >
          <option value="" disabled>선택</option>
          {situations.map((node) => (
            <option key={node.id} value={node.id}>{node.name}</option>
          ))}
        </select>
      </label>
      {selectedNodeId && !isSystemNode(graph.nodes.find((node) => node.id === selectedNodeId)) && (
        <label className="behavior-scope-field">
          <span>다음으로 연결</span>
          <select
            aria-label="다음으로 연결"
            data-testid="quick-connect"
            defaultValue=""
            onChange={(event) => {
              const targetId = event.target.value;
              event.target.value = "";
              if (!targetId || !selectedNodeId) return;
              const result = classifyAuthoringLink(graph, selectedNodeId, targetId);
              if (!result.ok) {
                onConnectRejected?.(result.message);
                return;
              }
              onEdgeConnect(selectedNodeId, targetId);
            }}
          >
            <option value="" disabled>대상 선택…</option>
            {situationNodesInScope(graph, scope).filter((node) => node.id !== selectedNodeId).map((node) => {
              const result = classifyAuthoringLink(graph, selectedNodeId, node.id);
              return (
                <option key={node.id} value={node.id} disabled={!result.ok}>
                  {node.name}{result.ok ? "" : ` — ${result.message}`}
                </option>
              );
            })}
          </select>
        </label>
      )}
      <button
        type="button"
        className="behavior-scope-chip"
        title="어느 상황에 있어도 조건이 맞으면 이동합니다"
        onClick={() => {
          if (interrupts[0]) onEdgeSelect(interrupts[0].id);
        }}
      >
        {ANYWHERE_INTERRUPT_LABEL} {interrupts.length}
      </button>
      <button
        type="button"
        className="behavior-scope-chip"
        title="Exit 전환을 종료/복귀로 표시합니다"
        onClick={() => {
          if (exits[0]) onEdgeSelect(exits[0].id);
        }}
      >
        종료/복귀 {exits.length}
      </button>
      {hasAny && onAddInterrupt && (
        <button
          type="button"
          className="behavior-scope-action"
          data-testid="anywhere-interrupt-button"
          disabled={!selectedNodeId || isSystemNode(graph.nodes.find((node) => node.id === selectedNodeId))}
          title="선택한 상황으로, 어떤 상황에서도 이동하는 규칙을 만듭니다"
          onClick={() => selectedNodeId && onAddInterrupt(selectedNodeId)}
        >
          {ANYWHERE_INTERRUPT_LABEL} → 선택 상황
        </button>
      )}
      {hasExit && onAddExitReturn && (
        <button
          type="button"
          className="behavior-scope-action"
          disabled={!selectedNodeId || isSystemNode(graph.nodes.find((node) => node.id === selectedNodeId))}
          onClick={() => selectedNodeId && onAddExitReturn(selectedNodeId)}
        >
          선택 → 종료
        </button>
      )}
    </div>
  );
}


