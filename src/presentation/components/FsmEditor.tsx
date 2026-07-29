import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { createState } from "../../domain/commands";
import { createId, type ConditionExpr, type FsmGraph } from "../../domain/project";
import { validateFsm } from "../../domain/validation";
import { useProjectStore } from "../../application/ProjectStore";

const sensorLabels: Record<string, string> = {
  "target.visible": "대상이 보임",
  "target.distance": "대상 거리",
  "target.action": "대상 행동",
  "self.healthRatio": "내 체력 비율",
  "self.cooldownReady": "행동 종료",
  "self.wasHit": "피격됨",
  "self.isGuarding": "가드 중",
};

function conditionText(condition: ConditionExpr): string {
  if (condition.kind === "all") return condition.children.map(conditionText).join(" 그리고 ");
  if (condition.kind === "any") return condition.children.map(conditionText).join(" 또는 ");
  if (condition.kind === "not") return `아님(${conditionText(condition.child)})`;
  const operators: Record<string, string> = {
    eq: "=",
    neq: "≠",
    gt: ">",
    gte: "≥",
    lt: "<",
    lte: "≤",
  };
  return `${sensorLabels[condition.sensor] ?? condition.sensor} ${operators[condition.operator]} ${String(condition.value)}`;
}

function graphNodes(graph: FsmGraph): Node[] {
  return graph.states.map((state) => ({
    id: state.id,
    position: state.position,
    data: {
      label: (
        <div className="state-node-content">
          <span>{state.name}</span>
          {graph.initialStateId === state.id && <small>시작</small>}
        </div>
      ),
    },
    className: graph.initialStateId === state.id ? "state-node initial" : "state-node",
  }));
}

function graphEdges(graph: FsmGraph): Edge[] {
  return graph.transitions.map((transition) => ({
    id: transition.id,
    source: transition.sourceStateId,
    target: transition.targetStateId,
    label: conditionText(transition.conditions),
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#63dacb" },
    style: { stroke: "#63dacb", strokeWidth: 1.6 },
    labelStyle: { fill: "#9fb7c5", fontSize: 11 },
    labelBgStyle: { fill: "#0e1822", fillOpacity: 0.94 },
    labelBgPadding: [7, 4],
    labelBgBorderRadius: 5,
  }));
}

export function FsmEditor() {
  const { document, dispatch } = useProjectStore();
  const graph = document.behaviorGraphs.find(
    (candidate): candidate is FsmGraph =>
      candidate.id === document.editor.selectedGraphId &&
      (candidate.kind === "fsm" || candidate.kind === "hfsm"),
  );
  const nodes = useMemo(() => (graph ? graphNodes(graph) : []), [graph]);
  const edges = useMemo(() => (graph ? graphEdges(graph) : []), [graph]);
  const issues = graph ? validateFsm(document, graph) : [];

  const addState = useCallback(() => {
    if (!graph) return;
    dispatch({
      type: "fsm/addState",
      graphId: graph.id,
      state: createState(`새 상태 ${graph.states.length + 1}`, {
        x: 180 + graph.states.length * 34,
        y: 180 + graph.states.length * 28,
      }),
    });
  }, [dispatch, graph]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!graph || !connection.source || !connection.target) return;
      dispatch({
        type: "fsm/addTransition",
        graphId: graph.id,
        transition: {
          id: createId("transition"),
          sourceStateId: connection.source,
          targetStateId: connection.target,
          priority: 10,
          interruptPolicy: "source",
          conditions: {
            kind: "compare",
            sensor: "target.visible",
            operator: "eq",
            value: true,
          },
        },
      });
    },
    [dispatch, graph],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!graph) return;
      changes.forEach((change) => {
        if (change.type !== "position" || !change.position || change.dragging) return;
        dispatch({
          type: "fsm/moveState",
          graphId: graph.id,
          stateId: change.id,
          position: change.position,
        });
      });
    },
    [dispatch, graph],
  );

  if (!graph) {
    return <div className="empty-state">편집할 FSM 그래프가 없습니다.</div>;
  }

  const selectedState = graph.states.find(
    (state) => state.id === document.editor.selectedStateId,
  );
  const selectedTransition = graph.transitions.find(
    (transition) => transition.id === document.editor.selectedTransitionId,
  );

  return (
    <div className="authoring-layout">
      <aside className="library-panel">
        <div className="panel-heading">
          <div>
            <small>상태 목록</small>
            <strong>{graph.name}</strong>
          </div>
          <button className="icon-button" onClick={addState} title="새 상태">
            <Plus size={17} />
          </button>
        </div>
        <div className="state-list">
          {graph.states.map((state) => (
            <button
              className={state.id === selectedState?.id ? "selected" : ""}
              key={state.id}
              onClick={() => dispatch({ type: "editor/selectState", stateId: state.id })}
            >
              <span className="state-dot" />
              <span>{state.name}</span>
              {graph.initialStateId === state.id && <small>시작</small>}
            </button>
          ))}
        </div>
        <div className="validation-summary">
          <strong>실행 전 검사</strong>
          {issues.length === 0 ? (
            <p className="validation-ok">문제가 없습니다.</p>
          ) : (
            issues.map((issue) => <p key={issue.id}>{issue.message}</p>)
          )}
        </div>
      </aside>

      <main className="graph-canvas">
        <div className="canvas-toolbar">
          <div>
            <strong>FSM 설계</strong>
            <span>포트에서 드래그해 전환을 연결하세요.</span>
          </div>
          <button className="primary compact" onClick={addState}>
            <Plus size={15} /> 상태 추가
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) =>
            dispatch({ type: "editor/selectState", stateId: node.id })
          }
          onEdgeClick={(_, edge) =>
            dispatch({ type: "editor/selectTransition", transitionId: edge.id })
          }
          fitView
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={null}
        >
          <Background color="#243b4b" gap={24} size={1} variant={BackgroundVariant.Dots} />
          <MiniMap
            className="minimap"
            nodeColor={(node) => (node.id === graph.initialStateId ? "#efae4f" : "#50cdbd")}
          />
          <Controls className="flow-controls" />
        </ReactFlow>
      </main>

      <aside className="property-panel">
        {selectedState ? (
          <StateProperties graph={graph} stateId={selectedState.id} />
        ) : selectedTransition ? (
          <TransitionProperties graph={graph} transitionId={selectedTransition.id} />
        ) : (
          <div className="empty-properties">
            <strong>속성</strong>
            <p>상태나 전환선을 선택하면 편집할 수 있습니다.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function StateProperties({ graph, stateId }: { graph: FsmGraph; stateId: string }) {
  const { document, dispatch } = useProjectStore();
  const state = graph.states.find((candidate) => candidate.id === stateId);
  if (!state) return null;

  return (
    <div className="property-form">
      <div className="panel-heading">
        <div>
          <small>상태 속성</small>
          <strong>{state.name}</strong>
        </div>
      </div>
      <label>
        상태 이름
        <input
          value={state.name}
          onChange={(event) =>
            dispatch({
              type: "fsm/renameState",
              graphId: graph.id,
              stateId,
              name: event.target.value,
            })
          }
        />
      </label>
      <label>
        진입 시 행동
        <select
          value={state.entryActionIds[0] ?? ""}
          onChange={(event) =>
            dispatch({
              type: "fsm/setStateActions",
              graphId: graph.id,
              stateId,
              entryActionIds: event.target.value ? [event.target.value] : [],
              updateActionIds: state.updateActionIds,
              exitActionIds: state.exitActionIds,
            })
          }
        >
          <option value="">없음</option>
          {document.actions.map((action) => (
            <option key={action.id} value={action.id}>
              {action.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary"
        disabled={graph.initialStateId === stateId}
        onClick={() => dispatch({ type: "fsm/setInitialState", graphId: graph.id, stateId })}
      >
        시작 상태로 지정
      </button>
      <button
        className="danger"
        onClick={() => dispatch({ type: "fsm/deleteState", graphId: graph.id, stateId })}
      >
        <Trash2 size={15} /> 상태 삭제
      </button>
    </div>
  );
}

function TransitionProperties({
  graph,
  transitionId,
}: {
  graph: FsmGraph;
  transitionId: string;
}) {
  const { dispatch } = useProjectStore();
  const transition = graph.transitions.find((candidate) => candidate.id === transitionId);
  if (!transition || transition.conditions.kind !== "compare") return null;
  const condition = transition.conditions;
  const source = graph.states.find((state) => state.id === transition.sourceStateId)?.name;
  const target = graph.states.find((state) => state.id === transition.targetStateId)?.name;

  return (
    <div className="property-form">
      <div className="panel-heading">
        <div>
          <small>전환 속성</small>
          <strong>
            {source} → {target}
          </strong>
        </div>
      </div>
      <label>
        판단 항목
        <select
          value={condition.sensor}
          onChange={(event) =>
            dispatch({
              type: "fsm/updateTransition",
              graphId: graph.id,
              transitionId,
              patch: {
                conditions: {
                  ...condition,
                  sensor: event.target.value as typeof condition.sensor,
                },
              },
            })
          }
        >
          {Object.entries(sensorLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="property-row">
        <label>
          비교
          <select
            value={condition.operator}
            onChange={(event) =>
              dispatch({
                type: "fsm/updateTransition",
                graphId: graph.id,
                transitionId,
                patch: {
                  conditions: {
                    ...condition,
                    operator: event.target.value as typeof condition.operator,
                  },
                },
              })
            }
          >
            <option value="eq">같음</option>
            <option value="neq">다름</option>
            <option value="lte">이하</option>
            <option value="gte">이상</option>
            <option value="lt">미만</option>
            <option value="gt">초과</option>
          </select>
        </label>
        <label>
          값
          <input
            value={String(condition.value)}
            onChange={(event) => {
              const raw = event.target.value;
              const numeric = Number(raw);
              const value =
                raw === "true" ? true : raw === "false" ? false : Number.isNaN(numeric) ? raw : numeric;
              dispatch({
                type: "fsm/updateTransition",
                graphId: graph.id,
                transitionId,
                patch: { conditions: { ...condition, value } },
              });
            }}
          />
        </label>
      </div>
      <label>
        우선순위
        <input
          type="number"
          value={transition.priority}
          onChange={(event) =>
            dispatch({
              type: "fsm/updateTransition",
              graphId: graph.id,
              transitionId,
              patch: { priority: Number(event.target.value) },
            })
          }
        />
      </label>
      <label>
        인터럽트
        <select
          value={transition.interruptPolicy}
          onChange={(event) =>
            dispatch({
              type: "fsm/updateTransition",
              graphId: graph.id,
              transitionId,
              patch: {
                interruptPolicy: event.target.value as typeof transition.interruptPolicy,
              },
            })
          }
        >
          <option value="none">행동 종료 후</option>
          <option value="source">현재 상태에서 허용</option>
          <option value="immediate">즉시 전환</option>
        </select>
      </label>
      <button
        className="danger"
        onClick={() =>
          dispatch({ type: "fsm/deleteTransition", graphId: graph.id, transitionId })
        }
      >
        <Trash2 size={15} /> 전환 삭제
      </button>
    </div>
  );
}
