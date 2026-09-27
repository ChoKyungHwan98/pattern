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
import type {
  GraphDefinition,
  GraphMode,
  GraphNode,
  Point,
  RuntimeState,
} from "../editor/model";
import { summarizeTransition } from "../editor/transitionSemantics";
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
  onSubmachineAdd: (position?: Point) => void;
  onScopeOpen: (scopeId: string) => void;
  onSetDefaultState: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeConnect: (source: string, target: string) => void;
  viewportCommand?: GraphViewportCommand;
  onShortcutHelp: () => void;
}

export interface GraphViewportCommand {
  id: number;
  type: "fit-all" | "fit-selected";
  nodeId?: string;
}

type StateNodeData = {
  node: GraphNode;
  runtimeState: RuntimeNodeState;
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
  onSubmachineAdd,
  onScopeOpen,
  onSetDefaultState,
  onNodeDelete,
  onEdgeConnect,
  viewportCommand,
  onShortcutHelp,
}: GraphEditorProps) {
  const [tool, setTool] = useState<"select" | "pan" | "connect">("select");
  const [zoom, setZoom] = useState(0.9);
  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow<PatternFlowNode>();
  const lastViewportCommandRef = useRef<number | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; position: Point; nodeId?: string }>();

  const nodes = useMemo(
    () => toFlowNodes(graph, scopeId, selectedNodeId, activeNodeId, runtimeState, runtimeNodeStates),
    [activeNodeId, graph, runtimeNodeStates, runtimeState, scopeId, selectedNodeId],
  );
  const edges = useMemo(() => toFlowEdges(graph, scopeId, selectedEdgeId), [graph, scopeId, selectedEdgeId]);

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
        <button onClick={() => onNodeAdd()}>
          <Plus size={14} />
          <span className="toolbar-label">{graphMode === "bt" ? "행동 추가" : "상태 추가"}</span>
          <ChevronDown size={11} />
        </button>
        {graphMode === "state-machine" && (
          <button onClick={() => onSubmachineAdd()} title="현재 화면 안에 하위 상태 머신을 만듭니다.">
            <Boxes size={14} />
            <span className="toolbar-label">하위 머신</span>
          </button>
        )}
        <button
          className={tool === "connect" ? "active" : ""}
          onClick={() => setTool(tool === "connect" ? "select" : "connect")}
        >
          <Waypoints size={14} />
          <span className="toolbar-label">전환 연결</span>
        </button>
        <button onClick={() => onNodesLayout(layoutGraph(graph, scopeId))}>
          <AlignHorizontalDistributeCenter size={14} />
          <span className="toolbar-label">자동 배치</span>
        </button>
        <span className="graph-toolbar-spacer" />
        <span className="graph-hint">연결점을 끌어 전환을 만드세요</span>
        <button className="shortcut-help-button" onClick={onShortcutHelp} title="편집기 단축키">
          <Keyboard size={14} />
          <span className="toolbar-label">단축키</span>
        </button>
      </div>

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
          onPaneClick={() => { setContextMenu(undefined); onNodeSelect(undefined); onEdgeSelect(undefined); }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ x: event.clientX, y: event.clientY, position: screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
          }}
          onNodeClick={(_, node) => {
            if (node.type === "patternState") { onEdgeSelect(undefined); onNodeSelect(node.id); }
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
            if (connection.source && connection.target && connection.source !== connection.target) {
              onEdgeConnect(connection.source, connection.target);
            }
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
                {graph.nodes.find((node) => node.id === contextMenu.nodeId)?.kind === "submachine" && <button onClick={() => { const scope = graph.nodes.find((node) => node.id === contextMenu.nodeId)?.childScopeId; if (scope) onScopeOpen(scope); setContextMenu(undefined); }}>하위 상태 머신 열기</button>}
                {["state", "submachine"].includes(graph.nodes.find((node) => node.id === contextMenu.nodeId)?.kind ?? "") && <button onClick={() => { onSetDefaultState(contextMenu.nodeId!); setContextMenu(undefined); }}>기본 상태로 지정</button>}
                <button onClick={() => { setTool("connect"); setContextMenu(undefined); }}>이 노드에서 전환 만들기</button>
                {!(["entry", "any", "exit"].includes(graph.nodes.find((node) => node.id === contextMenu.nodeId)?.kind ?? "")) && <button className="danger" onClick={() => { onNodeDelete(contextMenu.nodeId!); setContextMenu(undefined); }}>삭제</button>}
              </>
            ) : (
              <>
                <button onClick={() => { onNodeAdd(contextMenu.position); setContextMenu(undefined); }}>{graphMode === "bt" ? "행동 추가" : "상태 만들기"}</button>
                {graphMode === "state-machine" && <button onClick={() => { onSubmachineAdd(contextMenu.position); setContextMenu(undefined); }}>하위 상태 머신 만들기</button>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PatternStateNode({ data, selected }: NodeProps<StateFlowNode>) {
  const { node, runtimeState } = data;
  return (
    <div
      className={`graph-node kind-${node.kind} ${selected ? "selected" : ""} runtime-${runtimeState}`}
    >
      <Handle className="node-port input" type="target" position={Position.Top} />
      <span className="node-kind">{nodeKindLabel(node.kind)}</span>
      <strong>{node.name}</strong>
      <small>{node.subtitle ?? nodeKindName(node.kind)}</small>
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
): PatternFlowNode[] {
  const visibleScopeId = graph.mode === "bt" ? undefined : scopeId ?? graph.rootScopeId;
  return graph.nodes
    .filter((node) => graph.mode === "bt" || node.scopeId === visibleScopeId)
    .map((node): StateFlowNode => ({
      id: node.id,
      type: "patternState",
      position: node.position,
      selected: selectedNodeId === node.id,
      data: {
        node,
        runtimeState:
          activeNodeId === node.id && runtimeState !== "stopped"
            ? runtimeNodeStates[node.id] === "running"
              ? "running"
              : "active"
            : runtimeNodeStates[node.id] ?? "ready",
      },
      style: { width: nodeWidth, height: nodeHeight },
    }));
}

function toFlowEdges(graph: GraphDefinition, scopeId: string | undefined, selectedEdgeId?: string): Edge[] {
  const visibleIds = new Set(graph.nodes
    .filter((node) => graph.mode === "bt" || node.scopeId === (scopeId ?? graph.rootScopeId))
    .map((node) => node.id));
  return graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map((edge) => {
    const selected = edge.id === selectedEdgeId;
    const stroke =
      edge.accent === "success" ? "#6ca887" : edge.accent === "warning" ? "#b28a4b" : "#66737a";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: graph.mode === "bt" ? edge.label : summarizeTransition(edge),
      type: "smoothstep",
      className: `graph-edge ${edge.accent ?? "normal"}`,
      selected,
      markerEnd: { type: MarkerType.ArrowClosed, color: selected ? "#4cc2ff" : stroke },
      style: { stroke: selected ? "#4cc2ff" : stroke, strokeWidth: selected ? 2.2 : 1.4 },
      labelStyle: { fill: selected ? "#dff5ff" : "#aeb5ba", fontSize: 12 },
      labelBgStyle: { fill: selected ? "#12384a" : "#1b1e22", fillOpacity: 0.96 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 2,
    };
  });
}

function absolutePosition(node: PatternFlowNode): Point {
  return node.position;
}

function layoutGraph(graph: GraphDefinition, scopeId?: string): Record<string, Point> {
  const positions: Record<string, Point> = {};
  const currentNodes = graph.nodes.filter((node) => graph.mode === "bt" || node.scopeId === (scopeId ?? graph.rootScopeId));
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

function nodeKindLabel(kind: GraphNode["kind"]): string {
  const labels: Record<GraphNode["kind"], string> = {
    state: "S",
    submachine: "H",
    entry: "E",
    exit: "X",
    any: "A",
    selector: "선",
    sequence: "순",
    condition: "조",
    task: "행",
  };
  return labels[kind];
}

function nodeKindName(kind: GraphNode["kind"]): string {
  const labels: Record<GraphNode["kind"], string> = {
    state: "상태",
    submachine: "하위 상태 머신",
    entry: "진입",
    exit: "나가기",
    any: "전역 상태",
    selector: "선택",
    sequence: "순서",
    condition: "조건",
    task: "행동",
  };
  return labels[kind];
}
