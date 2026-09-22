import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Network,
  Plus,
  Pencil,
  Search,
  TreePine,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { GraphDefinition, GraphMode } from "../editor/model";

interface HierarchyPanelProps {
  setName: string;
  graphs: GraphDefinition[];
  graph?: GraphDefinition;
  selectedGraphId?: string;
  selectedNodeId?: string;
  activeScopeId?: string;
  onGraphChange: (graphId: string) => void;
  onGraphCreate: () => void;
  onGraphRename?: (graphId: string, name: string) => void;
  onGraphDuplicate?: (graphId: string) => void;
  onGraphDelete?: (graphId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  onScopeOpen?: (scopeId: string) => void;
}

export function HierarchyPanel({
  setName,
  graphs,
  graph,
  selectedGraphId,
  selectedNodeId,
  activeScopeId,
  onGraphChange,
  onGraphCreate,
  onGraphRename,
  onGraphDuplicate,
  onGraphDelete,
  onNodeSelect,
  onScopeOpen,
}: HierarchyPanelProps) {
  const [query, setQuery] = useState("");
  const [renamingGraphId, setRenamingGraphId] = useState<string>();
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGraphs = useMemo(
    () => graphs.filter((item) => !normalizedQuery || `${item.name} ${item.mode}`.toLowerCase().includes(normalizedQuery)),
    [graphs, normalizedQuery],
  );
  const matchingNodes = graph?.nodes.filter((node) =>
    !normalizedQuery || node.name.toLowerCase().includes(normalizedQuery),
  ) ?? [];
  const visibleNodes = graph?.mode === "bt"
    ? matchingNodes
    : matchingNodes.filter((node) => node.scopeId === (activeScopeId ?? graph?.rootScopeId));

  return (
    <aside className="pattern-sidebar">
      <div className="sidebar-heading">
        <div><span>패턴 세트</span><strong title={setName}>{setName}</strong></div>
        <span className="sidebar-count">{graphs.length}</span>
      </div>

      <div className="sidebar-search">
        <Search size={14} />
        <input data-pattern-search aria-label="그래프와 노드 검색" placeholder="그래프와 노드 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        <kbd>Ctrl F</kbd>
      </div>

      <div className="graph-list-heading">
        <strong>그래프 문서</strong>
        <button onClick={onGraphCreate}><Plus size={13} /> 새 그래프</button>
      </div>

      <nav className="pattern-list" aria-label="그래프 문서 목록">
        {filteredGraphs.map((item) => (
          <div className={`pattern-list-row ${selectedGraphId === item.id ? "active" : ""}`} key={item.id}>
          {renamingGraphId === item.id ? <input className="graph-rename-input" autoFocus defaultValue={item.name} onBlur={(event) => { const name = event.target.value.trim(); if (name) onGraphRename?.(item.id, name); setRenamingGraphId(undefined); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setRenamingGraphId(undefined); }} /> : <button className="pattern-list-main" onClick={() => onGraphChange(item.id)}>
            <span className={`pattern-icon mode-${item.mode}`}><ModeIcon mode={item.mode} /></span>
            <span><strong>{item.name}</strong><small>{modeLabel(item.mode)}</small></span>
            <b>{item.nodes.length}</b>
          </button>}
          <div className="pattern-list-actions"><button aria-label={`${item.name} 이름 변경`} onClick={() => setRenamingGraphId(item.id)}><Pencil size={12} /></button><button aria-label={`${item.name} 복제`} onClick={() => onGraphDuplicate?.(item.id)}><Copy size={12} /></button><button className={pendingDeleteId === item.id ? "confirm" : ""} aria-label={`${item.name} ${pendingDeleteId === item.id ? "삭제 확인" : "삭제"}`} onClick={() => { if (pendingDeleteId === item.id) { onGraphDelete?.(item.id); setPendingDeleteId(undefined); } else { setPendingDeleteId(item.id); window.setTimeout(() => setPendingDeleteId((current) => current === item.id ? undefined : current), 2400); } }}><Trash2 size={12} /></button></div>
          </div>
        ))}
        {!filteredGraphs.length && (
          <div className="graph-list-empty">{graphs.length ? "일치하는 그래프가 없습니다." : "새 그래프를 만들어 시작하세요."}</div>
        )}
      </nav>

      <div className="structure-heading">
        <strong>현재 구조</strong>
        <span>{graph ? `${matchingNodes.length}개 노드` : "그래프 없음"}</span>
      </div>

      <div className="structure-tree">
        {!graph ? (
          <div className="structure-empty">그래프를 선택하면 구조가 표시됩니다.</div>
        ) : (
          <>
            {graph.mode === "state-machine" && <div className="structure-group-title"><ChevronDown size={13} /><Network size={13} /><strong>{graph.scopes.find((scope) => scope.id === (activeScopeId ?? graph.rootScopeId))?.name ?? "상태 머신"}</strong><span>{visibleNodes.length}</span></div>}
            {visibleNodes.map((node) => <NodeRow key={node.id} label={node.name} selected={selectedNodeId === node.id} nested={graph.mode === "state-machine"} onClick={() => onNodeSelect(node.id)} onOpen={node.childScopeId && onScopeOpen ? () => onScopeOpen(node.childScopeId!) : undefined} />)}
            {visibleNodes.length === 0 && <div className="structure-empty">일치하는 노드가 없습니다.</div>}
          </>
        )}
      </div>
    </aside>
  );
}

function ModeIcon({ mode }: { mode: GraphMode }) {
  if (mode === "state-machine") return <Network size={16} />;
  return <TreePine size={16} />;
}

function modeLabel(mode: GraphMode): string {
  return mode === "bt" ? "행동 트리" : "상태 머신";
}

function NodeRow({ label, selected, nested = false, onClick, onOpen }: { label: string; selected: boolean; nested?: boolean; onClick: () => void; onOpen?: () => void }) {
  return (
    <div className="structure-node-row">
      <button className={`structure-node ${selected ? "selected" : ""} ${nested ? "nested" : ""}`} onClick={onClick}>
        <span className="node-indent">{nested ? <ChevronRight size={12} /> : null}</span><CircleDot size={13} /><span>{label}</span>
      </button>
      {onOpen && <button className="scope-open-button" aria-label={`${label} 열기`} title="하위 상태 머신 열기" onClick={onOpen}><ChevronRight size={13} /></button>}
    </div>
  );
}
