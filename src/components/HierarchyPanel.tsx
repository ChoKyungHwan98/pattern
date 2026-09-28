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
import { behaviorDocumentLabel, isCanvasVisibleNode } from "../editor/behaviorUi";
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
  const [legacyOpen, setLegacyOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGraphs = useMemo(
    () => graphs.filter((item) => !normalizedQuery || `${item.name} ${item.mode}`.toLowerCase().includes(normalizedQuery)),
    [graphs, normalizedQuery],
  );
  const primaryGraphs = filteredGraphs.filter((item) => !item.legacyExample);
  const legacyGraphs = filteredGraphs.filter((item) => item.legacyExample);
  const matchingNodes = graph?.nodes.filter((node) =>
    !normalizedQuery || node.name.toLowerCase().includes(normalizedQuery),
  ) ?? [];
  const visibleNodes = (graph?.mode === "bt"
    ? matchingNodes
    : matchingNodes.filter((node) => node.scopeId === (activeScopeId ?? graph?.rootScopeId))
  ).filter(isCanvasVisibleNode);

  // If the selected graph is legacy, keep the section open so the user sees it.
  const showLegacy = legacyOpen || Boolean(graph?.legacyExample);

  return (
    <aside className="pattern-sidebar">
      <div className="sidebar-heading">
        <div><span>패턴 세트</span><strong title={setName}>{setName}</strong></div>
        <span className="sidebar-count">{primaryGraphs.length}</span>
      </div>

      <div className="sidebar-search">
        <Search size={14} />
        <input data-pattern-search aria-label="패턴과 요소 검색" placeholder="패턴과 요소 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        <kbd>Ctrl F</kbd>
      </div>

      <div className="graph-list-heading">
        <strong>행동 패턴</strong>
        <button onClick={onGraphCreate}><Plus size={13} /> 새 패턴</button>
      </div>

      <nav className="pattern-list" aria-label="행동 패턴 목록">
        {primaryGraphs.map((item) => (
          <GraphRow
            key={item.id}
            item={item}
            selected={selectedGraphId === item.id}
            renaming={renamingGraphId === item.id}
            pendingDelete={pendingDeleteId === item.id}
            onSelect={() => onGraphChange(item.id)}
            onRenameStart={() => setRenamingGraphId(item.id)}
            onRenameCommit={(name) => { if (name) onGraphRename?.(item.id, name); setRenamingGraphId(undefined); }}
            onRenameCancel={() => setRenamingGraphId(undefined)}
            onDuplicate={() => onGraphDuplicate?.(item.id)}
            onDelete={() => {
              if (pendingDeleteId === item.id) {
                onGraphDelete?.(item.id);
                setPendingDeleteId(undefined);
              } else {
                setPendingDeleteId(item.id);
                window.setTimeout(() => setPendingDeleteId((current) => current === item.id ? undefined : current), 2400);
              }
            }}
          />
        ))}
        {!primaryGraphs.length && (
          <div className="graph-list-empty">{graphs.some((item) => !item.legacyExample) ? "일치하는 패턴이 없습니다." : "새 패턴을 만들어 시작하세요."}</div>
        )}
      </nav>

      {legacyGraphs.length > 0 && (
        <details className="legacy-example-section" open={showLegacy} data-testid="legacy-examples">
          <summary
            onClick={(event) => {
              event.preventDefault();
              setLegacyOpen((open) => !open);
            }}
          >
            {showLegacy ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <strong>고급 · 레거시 예제</strong>
            <span>{legacyGraphs.length}</span>
          </summary>
          <nav className="pattern-list legacy-list" aria-label="레거시 예제 목록">
            {showLegacy && legacyGraphs.map((item) => (
              <GraphRow
                key={item.id}
                item={item}
                selected={selectedGraphId === item.id}
                renaming={renamingGraphId === item.id}
                pendingDelete={pendingDeleteId === item.id}
                onSelect={() => onGraphChange(item.id)}
                onRenameStart={() => setRenamingGraphId(item.id)}
                onRenameCommit={(name) => { if (name) onGraphRename?.(item.id, name); setRenamingGraphId(undefined); }}
                onRenameCancel={() => setRenamingGraphId(undefined)}
                onDuplicate={() => onGraphDuplicate?.(item.id)}
                onDelete={() => {
                  if (pendingDeleteId === item.id) {
                    onGraphDelete?.(item.id);
                    setPendingDeleteId(undefined);
                  } else {
                    setPendingDeleteId(item.id);
                    window.setTimeout(() => setPendingDeleteId((current) => current === item.id ? undefined : current), 2400);
                  }
                }}
              />
            ))}
          </nav>
        </details>
      )}

      <div className="structure-heading">
        <strong>현재 구조</strong>
        <span>{graph ? `${visibleNodes.length}개 요소` : "패턴 없음"}</span>
      </div>

      <div className="structure-tree">
        {!graph ? (
          <div className="structure-empty">패턴을 선택하면 구조가 표시됩니다.</div>
        ) : (
          <>
            {graph.mode === "state-machine" && <div className="structure-group-title"><ChevronDown size={13} /><Network size={13} /><strong>{graph.scopes.find((scope) => scope.id === (activeScopeId ?? graph.rootScopeId))?.name ?? "행동 범위"}</strong><span>{visibleNodes.length}</span></div>}
            {visibleNodes.map((node) => <NodeRow key={node.id} label={node.name} selected={selectedNodeId === node.id} nested={graph.mode === "state-machine"} onClick={() => onNodeSelect(node.id)} onOpen={node.childScopeId && onScopeOpen ? () => onScopeOpen(node.childScopeId!) : undefined} />)}
            {visibleNodes.length === 0 && <div className="structure-empty">표시할 요소가 없습니다.</div>}
          </>
        )}
      </div>
    </aside>
  );
}

function GraphRow({
  item,
  selected,
  renaming,
  pendingDelete,
  onSelect,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onDuplicate,
  onDelete,
}: {
  item: GraphDefinition;
  selected: boolean;
  renaming: boolean;
  pendingDelete: boolean;
  onSelect: () => void;
  onRenameStart: () => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`pattern-list-row ${selected ? "active" : ""}`}>
      {renaming ? (
        <input
          className="graph-rename-input"
          autoFocus
          defaultValue={item.name}
          onBlur={(event) => onRenameCommit(event.target.value.trim())}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") onRenameCancel();
          }}
        />
      ) : (
        <button className="pattern-list-main" onClick={onSelect}>
          <span className={`pattern-icon mode-${item.mode}`}><ModeIcon mode={item.mode} /></span>
          <span><strong>{item.name}</strong><small>{modeLabel(item.mode)}</small></span>
          <b>{item.nodes.length}</b>
        </button>
      )}
      <div className="pattern-list-actions">
        <button aria-label={`${item.name} 이름 변경`} onClick={onRenameStart}><Pencil size={12} /></button>
        <button aria-label={`${item.name} 복제`} onClick={onDuplicate}><Copy size={12} /></button>
        <button
          className={pendingDelete ? "confirm" : ""}
          aria-label={`${item.name} ${pendingDelete ? "삭제 확인" : "삭제"}`}
          onClick={onDelete}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function ModeIcon({ mode }: { mode: GraphMode }) {
  if (mode === "state-machine") return <Network size={16} />;
  return <TreePine size={16} />;
}

function modeLabel(mode: GraphMode): string {
  return behaviorDocumentLabel(mode);
}

function NodeRow({ label, selected, nested = false, onClick, onOpen }: { label: string; selected: boolean; nested?: boolean; onClick: () => void; onOpen?: () => void }) {
  return (
    <div className="structure-node-row">
      <button className={`structure-node ${selected ? "selected" : ""} ${nested ? "nested" : ""}`} onClick={onClick}>
        <span className="node-indent">{nested ? <ChevronRight size={12} /> : null}</span><CircleDot size={13} /><span>{label}</span>
      </button>
      {onOpen && <button className="scope-open-button" aria-label={`${label} 열기`} title="행동 묶음 열기" onClick={onOpen}><ChevronRight size={13} /></button>}
    </div>
  );
}