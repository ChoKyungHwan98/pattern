import {
  Braces,
  ChevronDown,
  CircleDot,
  Gauge,
  Link2,
  Network,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ActionDefinition, GraphDefinition, GraphMode, GraphNode, RuntimeState, StateMachineScope } from "../editor/model";
import type { RuntimeNodeState } from "../runtime/types";

interface InspectorPanelProps {
  graph: GraphDefinition;
  graphMode: GraphMode;
  selectedNode: GraphNode;
  actionDefinitions: ActionDefinition[];
  runtimeState: RuntimeState;
  runtimeNodeState?: RuntimeNodeState;
  onNodeNameChange: (name: string) => void;
  onNodeChange: (node: GraphNode) => void;
  onScopeChange: (scopeId: string, patch: Partial<StateMachineScope>) => void;
  onSetDefaultState: (nodeId: string) => void;
  onScopeOpen: (scopeId: string) => void;
  onNodeDelete: () => void;
  onTransitionSelect: (edgeId: string) => void;
  onClose: () => void;
}

export function InspectorPanel({
  graph,
  graphMode,
  selectedNode,
  actionDefinitions,
  runtimeState,
  runtimeNodeState,
  onNodeNameChange,
  onNodeChange,
  onScopeChange,
  onSetDefaultState,
  onScopeOpen,
  onNodeDelete,
  onTransitionSelect,
  onClose,
}: InspectorPanelProps) {
  const incoming = graph.edges.filter((edge) => edge.target === selectedNode.id);
  const outgoing = graph.edges.filter((edge) => edge.source === selectedNode.id);
  const parentName = graph.scopes.find((scope) => scope.id === selectedNode.scopeId)?.name;
  const scope = graph.scopes.find((item) => item.id === selectedNode.scopeId);
  const childScope = graph.scopes.find((item) => item.id === selectedNode.childScopeId);
  const isDefault = scope?.initialNodeId === selectedNode.id;
  const updateNode = (patch: Partial<GraphNode>) => onNodeChange({ ...selectedNode, ...patch });

  return (
    <aside className="pattern-inspector">
      <header className="inspector-header">
        <div>
          <span>선택 항목</span>
          <strong>속성</strong>
        </div>
        <button aria-label="속성 닫기" title="속성 닫기" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="inspector-scroll">
        <div className="inspector-summary">
          <span className={`summary-icon kind-${selectedNode.kind}`}>
            <CircleDot size={18} />
          </span>
          <div>
            <strong>{selectedNode.name}</strong>
            <span>{nodeTypeLabel(selectedNode.kind)}</span>
          </div>
          <span className={`runtime-chip state-${runtimeNodeState ?? "ready"}`}>
            {runtimeLabel(runtimeState, runtimeNodeState)}
          </span>
        </div>

        <InspectorSection title="기본 정보" icon={<CircleDot size={14} />}>
          <InspectorField label="이름">
            <input data-node-name-input value={selectedNode.name} onChange={(event) => onNodeNameChange(event.target.value)} />
          </InspectorField>
          <InspectorField label="노드 유형">
            <div className="read-only-field">{nodeTypeLabel(selectedNode.kind)}</div>
          </InspectorField>
          {parentName && (
            <InspectorField label="상위 상태">
              <div className="read-only-field with-icon">
                <Network size={12} />
                {parentName}
              </div>
            </InspectorField>
          )}
          <InspectorField label="고유 ID">
            <code className="id-field">{selectedNode.id}</code>
          </InspectorField>
          {graphMode === "state-machine" && ["state", "submachine"].includes(selectedNode.kind) && (
            <InspectorField label="기본 상태">
              <button className="read-only-field inspector-inline-action" disabled={isDefault} onClick={() => onSetDefaultState(selectedNode.id)}>{isDefault ? "현재 기본 상태" : "기본 상태로 지정"}</button>
            </InspectorField>
          )}
        </InspectorSection>

        <InspectorSection title="실행" icon={<Braces size={14} />}>
          <InspectorField label={graphMode === "bt" ? "호출 행동" : "진입 행동"}>
            <input value={selectedNode.action ?? ""} placeholder="지정되지 않음" onChange={(event) => updateNode({ action: event.target.value || undefined })} />
          </InspectorField>
          <textarea className="description-field" value={selectedNode.description ?? ""} placeholder="이 상태의 책임과 종료 조건을 기록하세요." onChange={(event) => updateNode({ description: event.target.value || undefined })} />
          <InspectorField label="중단점">
            <select value={selectedNode.breakpoint ? "on" : "off"} onChange={(event) => updateNode({ breakpoint: event.target.value === "on" })}><option value="off">사용 안 함</option><option value="on">진입 시 일시 정지</option></select>
          </InspectorField>
        </InspectorSection>

        {graphMode === "state-machine" && !["entry", "any", "exit", "submachine"].includes(selectedNode.kind) && (
          <InspectorSection title="상태 행동" icon={<Braces size={14} />} count={selectedNode.actions?.length ?? 0}>
            <div className="state-action-list">
              {(selectedNode.actions ?? []).map((binding) => (
                <div className="state-action-row" key={binding.id}>
                  <select value={binding.phase} onChange={(event) => updateNode({ actions: selectedNode.actions?.map((item) => item.id === binding.id ? { ...item, phase: event.target.value as typeof item.phase } : item) })}>
                    <option value="enter">On Enter</option><option value="update">On Update</option><option value="exit">On Exit</option><option value="can-exit">Can Exit</option>
                  </select>
                  <select value={binding.actionId} onChange={(event) => updateNode({ actions: selectedNode.actions?.map((item) => item.id === binding.id ? { ...item, actionId: event.target.value } : item) })}>
                    <option value="">행동 선택</option>{actionDefinitions.map((action) => <option value={action.id} key={action.id}>{action.name}</option>)}
                  </select>
                  <button aria-label="상태 행동 삭제" onClick={() => updateNode({ actions: selectedNode.actions?.filter((item) => item.id !== binding.id) })}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <button className="inspector-add-button" onClick={() => updateNode({ actions: [...(selectedNode.actions ?? []), { id: crypto.randomUUID(), phase: "enter", actionId: actionDefinitions[0]?.id ?? "", parameters: {} }] })}><Plus size={13} /> 상태 행동 추가</button>
            {!actionDefinitions.length && <p className="inspector-help">블랙보드 패널의 카탈로그에서 행동 정의를 먼저 추가하세요.</p>}
          </InspectorSection>
        )}

        {childScope && (
          <InspectorSection title="하위 상태 머신" icon={<Network size={14} />}>
            <InspectorField label="이름"><input value={childScope.name} onChange={(event) => onScopeChange(childScope.id, { name: event.target.value })} /></InspectorField>
            <InspectorField label="재진입 기록"><select value={childScope.history} onChange={(event) => onScopeChange(childScope.id, { history: event.target.value as StateMachineScope["history"] })}><option value="none">초기 상태부터</option><option value="shallow">얕은 기록</option><option value="deep">깊은 기록</option></select></InspectorField>
            <InspectorField label="실행 방식"><select value={childScope.regionMode} onChange={(event) => onScopeChange(childScope.id, { regionMode: event.target.value as StateMachineScope["regionMode"] })}><option value="exclusive">단일 상태</option><option value="parallel">병렬 리전</option></select></InspectorField>
            <button className="inspector-add-button" onClick={() => onScopeOpen(childScope.id)}>하위 상태 머신 열기</button>
          </InspectorSection>
        )}

        {(selectedNode.decorators?.length ?? 0) > 0 && (
          <InspectorSection
            title="조건"
            icon={<Braces size={14} />}
            count={selectedNode.decorators?.length}
          >
            <div className="condition-list">
              {selectedNode.decorators?.map((decorator) => (
                <div className="condition-row" key={decorator}>
                  <span />
                  {decorator}
                </div>
              ))}
            </div>
          </InspectorSection>
        )}

        <InspectorSection
          title="연결"
          icon={<Link2 size={14} />}
          count={incoming.length + outgoing.length}
        >
          <div className="transition-list">
            {outgoing.map((edge) => (
              <TransitionRow
                key={edge.id}
                direction="나감"
                name={graph.nodes.find((node) => node.id === edge.target)?.name ?? edge.target}
                condition={edge.label ?? "항상"}
                priority={edge.priority}
                onClick={() => onTransitionSelect(edge.id)}
              />
            ))}
            {incoming.map((edge) => (
              <TransitionRow
                key={edge.id}
                direction="들어옴"
                name={graph.nodes.find((node) => node.id === edge.source)?.name ?? edge.source}
                condition={edge.label ?? "항상"}
                priority={edge.priority}
                onClick={() => onTransitionSelect(edge.id)}
              />
            ))}
            {incoming.length + outgoing.length === 0 && (
              <div className="inspector-empty-row">연결된 전환이 없습니다.</div>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="실행 상태" icon={<Gauge size={14} />}>
          <div className="runtime-detail">
            <span>현재 상태</span>
            <strong>{runtimeLabel(runtimeState, runtimeNodeState)}</strong>
          </div>
          <div className="runtime-detail">
            <span>문서 유형</span>
            <strong>{graphMode === "bt" ? "행동 트리" : "상태 머신"}</strong>
          </div>
        </InspectorSection>

        <div className="inspector-danger-zone">
          <button onClick={onNodeDelete} disabled={["entry", "any", "exit"].includes(selectedNode.kind)}><Trash2 size={13} /> {["entry", "any", "exit"].includes(selectedNode.kind) ? "시스템 노드는 삭제할 수 없음" : "노드 삭제"}</button>
        </div>
      </div>
    </aside>
  );
}

function InspectorSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="inspector-section">
      <header>
        <ChevronDown size={13} />
        {icon}
        <strong>{title}</strong>
        {count !== undefined && <span>{count}</span>}
      </header>
      <div className="inspector-section-body">{children}</div>
    </section>
  );
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TransitionRow({
  direction,
  name,
  condition,
  priority,
  onClick,
}: {
  direction: "나감" | "들어옴";
  name: string;
  condition: string;
  priority?: number;
  onClick: () => void;
}) {
  return (
    <button className={`transition-row ${direction === "들어옴" ? "incoming" : ""}`} onClick={onClick}>
      <span>{direction}</span>
      <div>
        <strong>{name}</strong>
        <small>{condition}</small>
      </div>
      <b>{priority ?? 0}</b>
    </button>
  );
}

function nodeTypeLabel(kind: GraphNode["kind"]): string {
  const labels: Record<GraphNode["kind"], string> = {
    state: "상태",
    submachine: "하위 상태 머신",
    entry: "진입 노드",
    exit: "나가기 노드",
    any: "전역 상태",
    selector: "선택 노드",
    sequence: "순서 노드",
    condition: "조건 노드",
    task: "행동 노드",
  };
  return labels[kind];
}

function runtimeLabel(state: RuntimeState, nodeState?: RuntimeNodeState): string {
  if (state === "stopped") return "대기";
  if (nodeState === "active" || nodeState === "running") return "실행 중";
  if (nodeState === "success") return "성공";
  if (nodeState === "failure") return "실패";
  return "미실행";
}
