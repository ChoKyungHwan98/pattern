import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronDown,
  ListTree,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ActionDefinition, BlackboardEntry, ConditionDefinition, DrawerTab, GraphDefinition, GraphNode, TraceEvent } from "../editor/model";
import { contextEntryLabel, createContextVariableEntry } from "../editor/authoringFlow";
import { resolveDomainEntityKind } from "../editor/domain";
import { DecisionTracePanel } from "./DecisionTracePanel";
import { GoalPlanPanel } from "./GoalPlanPanel";
import type { GraphIssue } from "../editor/graphValidation";
import type { RuntimeEngine } from "../runtime/types";

interface BottomPanelProps {
  activeTab?: DrawerTab;
  issues: GraphIssue[];
  blackboard: BlackboardEntry[];
  actions: ActionDefinition[];
  conditions: ConditionDefinition[];
  trace: TraceEvent[];
  engine: RuntimeEngine;
  lastSignal?: string;
  tick: number;
  coverage: Record<string, number>;
  stateDurationsMs: Record<string, number>;
  failedConditions: Array<{ edgeId: string; reason: string }>;
  /** Canvas selection — drives Simulation contextual panes. */
  selectedNode?: GraphNode;
  graph?: GraphDefinition;
  nameLookup?: Record<string, string>;
  /** Simulation active → show live decision scores. */
  simulationActive?: boolean;
  onBlackboardChange: (entries: BlackboardEntry[]) => void;
  onCatalogChange: (actions: ActionDefinition[], conditions: ConditionDefinition[]) => void;
  onEventSend: (eventName: string) => void;
  onSeek: (tick: number) => void;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
}

type SimulationPane = "auto" | "decision" | "goal" | "situation" | "action" | "trace";

function resolveSimulationFocus(node?: GraphNode): Exclude<SimulationPane, "auto"> {
  if (!node) return "trace";
  const entity = resolveDomainEntityKind(node);
  if (entity === "decision" || node.kind === "selector") return "decision";
  if (entity === "action" || node.kind === "task") return "action";
  if (entity === "state" || node.kind === "state" || node.kind === "submachine") return "situation";
  return "trace";
}

export function BottomPanel({
  activeTab,
  issues,
  blackboard,
  actions,
  conditions,
  trace,
  engine,
  lastSignal,
  tick,
  coverage,
  stateDurationsMs,
  failedConditions,
  selectedNode,
  graph,
  nameLookup = {},
  simulationActive = false,
  onBlackboardChange,
  onCatalogChange,
  onEventSend,
  onSeek,
  onTabChange,
  onClose,
}: BottomPanelProps) {
  return (
    <section className={`runtime-drawer ${activeTab ? "open" : "closed"}`}>
      <nav className="drawer-tabs" aria-label="보조 패널">
        <DrawerButton
          active={activeTab === "context"}
          label="문맥"
          count={blackboard.length}
          icon={<Braces size={14} />}
          onClick={() => onTabChange("context")}
        />
        <DrawerButton
          active={activeTab === "simulation"}
          label="시뮬레이션"
          count={trace.length}
          icon={<ListTree size={14} />}
          onClick={() => onTabChange("simulation")}
        />
        <DrawerButton
          active={activeTab === "validation"}
          label="검증"
          count={issues.length}
          icon={<AlertTriangle size={14} />}
          onClick={() => onTabChange("validation")}
        />
        <DrawerButton
          active={activeTab === "review"}
          label="리뷰"
          count={issues.length}
          icon={<Sparkles size={14} />}
          onClick={() => onTabChange("review")}
        />
        <span className="drawer-spacer" />
        <div className="drawer-engine">
          <span title={engine}>시뮬레이터</span>
          {lastSignal && <strong>{lastSignal}</strong>}
        </div>
        {activeTab && (
          <button className="drawer-close" aria-label="보조 패널 닫기" onClick={onClose}>
            <ChevronDown size={16} />
          </button>
        )}
      </nav>

      {activeTab && (
        <div className="drawer-content">
          {activeTab === "context" && (
            <ContextContent
              entries={blackboard}
              actions={actions}
              conditions={conditions}
              onChange={onBlackboardChange}
              onCatalogChange={onCatalogChange}
              onEventSend={onEventSend}
            />
          )}
          {activeTab === "simulation" && (
            <SimulationContent
              selectedNode={selectedNode}
              graph={graph}
              blackboard={blackboard}
              nameLookup={nameLookup}
              simulationActive={Boolean(simulationActive) || activeTab === "simulation"}
              entries={trace}
              tick={tick}
              coverage={coverage}
              stateDurationsMs={stateDurationsMs}
              failedConditions={failedConditions}
              onSeek={onSeek}
            />
          )}
          {activeTab === "validation" && <ValidationContent issues={issues} />}
          {activeTab === "review" && <ReviewContent issues={issues} />}
        </div>
      )}
    </section>
  );
}

function DrawerButton({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {label}
      <span>{count}</span>
    </button>
  );
}

function SimulationContent({
  selectedNode,
  graph,
  blackboard,
  nameLookup,
  simulationActive,
  entries,
  tick,
  coverage,
  stateDurationsMs,
  failedConditions,
  onSeek,
}: {
  selectedNode?: GraphNode;
  graph?: GraphDefinition;
  blackboard: BlackboardEntry[];
  nameLookup: Record<string, string>;
  simulationActive: boolean;
  entries: TraceEvent[];
  tick: number;
  coverage: Record<string, number>;
  stateDurationsMs: Record<string, number>;
  failedConditions: Array<{ edgeId: string; reason: string }>;
  onSeek: (tick: number) => void;
}) {
  const autoFocus = resolveSimulationFocus(selectedNode);
  const [paneOverride, setPaneOverride] = useState<SimulationPane>("auto");
  const pane = paneOverride === "auto" ? autoFocus : paneOverride;

  return (
    <div className="simulation-panel" data-testid="simulation-panel">
      <div className="simulation-pane-bar" role="tablist" aria-label="시뮬레이션 보기">
        <PaneChip active={paneOverride === "auto"} label={`자동 · ${paneLabel(autoFocus)}`} onClick={() => setPaneOverride("auto")} />
        <PaneChip active={pane === "decision" && paneOverride !== "auto"} label="판단" onClick={() => setPaneOverride("decision")} />
        <PaneChip active={pane === "goal" && paneOverride !== "auto"} label="목표·계획" onClick={() => setPaneOverride("goal")} />
        <PaneChip active={pane === "situation" && paneOverride !== "auto"} label="상황" onClick={() => setPaneOverride("situation")} />
        <PaneChip active={pane === "action" && paneOverride !== "auto"} label="행동" onClick={() => setPaneOverride("action")} />
        <PaneChip active={pane === "trace" && paneOverride !== "auto"} label="실행 기록" onClick={() => setPaneOverride("trace")} />
      </div>

      {pane === "decision" && (
        <DecisionTracePanel
          decisionNode={
            selectedNode && (resolveDomainEntityKind(selectedNode) === "decision" || selectedNode.kind === "selector")
              ? selectedNode
              : undefined
          }
          blackboard={blackboard}
          nameLookup={nameLookup}
          simulationActive={simulationActive}
        />
      )}
      {pane === "goal" && <GoalPlanPanel blackboard={blackboard} variant="simulation" />}
      {pane === "situation" && <SituationSimContent node={selectedNode} graph={graph} nameLookup={nameLookup} />}
      {pane === "action" && <ActionSimContent node={selectedNode} entries={entries} />}
      {pane === "trace" && (
        <TraceContent
          entries={entries}
          tick={tick}
          coverage={coverage}
          stateDurationsMs={stateDurationsMs}
          failedConditions={failedConditions}
          onSeek={onSeek}
        />
      )}
    </div>
  );
}

function PaneChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={active ? "is-active" : ""} onClick={onClick}>
      {label}
    </button>
  );
}

function paneLabel(pane: Exclude<SimulationPane, "auto">): string {
  switch (pane) {
    case "decision":
      return "판단";
    case "goal":
      return "목표·계획";
    case "situation":
      return "상황";
    case "action":
      return "행동";
    case "trace":
      return "실행 기록";
  }
}

function SituationSimContent({
  node,
  graph,
  nameLookup,
}: {
  node?: GraphNode;
  graph?: GraphDefinition;
  nameLookup: Record<string, string>;
}) {
  if (!node || !graph) {
    return (
      <div className="drawer-empty">
        <ListTree size={18} />
        <div>
          <strong>상황을 선택하세요</strong>
          <span>캔버스에서 상황 노드를 고르면 현재·진입·다음 흐름이 표시됩니다.</span>
        </div>
      </div>
    );
  }
  const inbound = graph.edges.filter((edge) => edge.target === node.id);
  const outbound = graph.edges.filter((edge) => edge.source === node.id);
  return (
    <div className="sim-situation" data-testid="sim-situation">
      <header>
        <strong>{node.name}</strong>
        <span>현재 상황 · 진입 / 다음 흐름</span>
      </header>
      <div className="sim-flow-columns">
        <section>
          <h4>진입</h4>
          {inbound.length === 0 ? <p className="inspector-help">진입 흐름 없음</p> : (
            <ul>
              {inbound.map((edge) => (
                <li key={edge.id}>
                  <code>{nameLookup[edge.source] ?? edge.source}</code>
                  <span>→</span>
                  <em>{edge.label || edge.eventName || "흐름"}</em>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4>다음</h4>
          {outbound.length === 0 ? <p className="inspector-help">다음 흐름 없음</p> : (
            <ul>
              {outbound.map((edge) => (
                <li key={edge.id}>
                  <em>{edge.label || edge.eventName || "흐름"}</em>
                  <span>→</span>
                  <code>{nameLookup[edge.target] ?? edge.target}</code>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ActionSimContent({ node, entries }: { node?: GraphNode; entries: TraceEvent[] }) {
  if (!node) {
    return (
      <div className="drawer-empty">
        <ListTree size={18} />
        <div>
          <strong>행동을 선택하세요</strong>
          <span>실행 · 완료 · 중단 기록이 여기에 모입니다.</span>
        </div>
      </div>
    );
  }
  const related = entries.filter(
    (entry) =>
      entry.entity === node.id
      || entry.entity === node.name
      || entry.message.includes(node.name)
      || (node.action ? entry.entity === node.action || entry.message.includes(node.action) : false),
  );
  const intent = node.domain && "intent" in node.domain ? String(node.domain.intent ?? "") : "";
  return (
    <div className="sim-action" data-testid="sim-action">
      <header>
        <strong>{node.name}</strong>
        <span>실행 · 완료 · 중단</span>
      </header>
      {intent && <p className="inspector-help">의도: {intent}</p>}
      {node.domain && "completionCondition" in node.domain && node.domain.completionCondition && (
        <p className="inspector-help">완료 조건: {String(node.domain.completionCondition)}</p>
      )}
      {related.length === 0 ? (
        <p className="inspector-help">이 행동에 대한 실행 기록이 아직 없습니다. 시뮬레이션을 실행해 보세요.</p>
      ) : (
        <ul className="sim-action-log">
          {related.slice().reverse().map((entry) => (
            <li key={`${entry.tick}:${entry.message}`}>
              <span className={`trace-kind kind-${entry.category.toLowerCase()}`}>{traceLabel(entry.category)}</span>
              <strong>{entry.message}</strong>
              <code>t={entry.tick}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewContent({ issues }: { issues: GraphIssue[] }) {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return (
    <div className="review-stub">
      <div className="review-stub-summary">
        <strong>규칙 검증 요약</strong>
        <span>
          {issues.length === 0
            ? "구조 검증을 통과했습니다."
            : `오류 ${errors}개 · 경고 ${warnings}개 · 총 ${issues.length}개`}
        </span>
      </div>
      {issues.length > 0 && (
        <div className="issue-list review-issue-preview">
          {issues.slice(0, 5).map((issue) => (
            <div className={`issue-row severity-${issue.severity}`} key={issue.id}>
              {issue.severity === "error" ? <X size={14} /> : <AlertTriangle size={14} />}
              <span>{issue.severity === "error" ? "오류" : "경고"}</span>
              <strong>{issue.message}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="review-stub-placeholder">
        <Sparkles size={18} />
        <div>
          <strong>리뷰 패널 (준비 중)</strong>
          <span>지금은 규칙 검증 결과만 보여 줍니다. AI 리뷰는 이 PR 범위에 포함되지 않습니다.</span>
        </div>
      </div>
    </div>
  );
}

function ValidationContent({ issues }: { issues: GraphIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="drawer-empty valid">
        <CheckCircle2 size={24} />
        <div>
          <strong>구조 검증을 통과했습니다.</strong>
          <span>시작 상황, 연결, 계층·전환 구조에 문제가 없습니다.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <div className={`issue-row severity-${issue.severity}`} key={issue.id}>
          {issue.severity === "error" ? <X size={14} /> : <AlertTriangle size={14} />}
          <span>{issue.severity === "error" ? "오류" : "경고"}</span>
          <strong>{issue.message}</strong>
          <code>{issue.entityId ?? issue.id}</code>
        </div>
      ))}
    </div>
  );
}

function TraceContent({ entries, tick, coverage, stateDurationsMs, failedConditions, onSeek }: {
  entries: TraceEvent[];
  tick: number;
  coverage: Record<string, number>;
  stateDurationsMs: Record<string, number>;
  failedConditions: Array<{ edgeId: string; reason: string }>;
  onSeek: (tick: number) => void;
}) {
  return (
    <div className="trace-debugger">
      <div className="trace-timeline"><strong>결정적 재생</strong><input aria-label="실행 시점" type="range" min={0} max={Math.max(0, tick)} value={tick} onChange={(event) => onSeek(Number(event.target.value))} /><span>{tick} 틱</span><b>방문 {Object.values(coverage).reduce((sum, value) => sum + value, 0)}회 · 체류 {Math.round(Object.values(stateDurationsMs).reduce((sum, value) => sum + value, 0))}ms</b></div>
      {failedConditions.length > 0 && <div className="failed-condition-strip"><strong>직전 미충족</strong>{failedConditions.slice(0, 3).map((item) => <span key={item.edgeId}>{item.reason}</span>)}</div>}
      <div className="drawer-table-wrap">
      <table className="drawer-table">
        <thead>
          <tr>
            <th>틱</th>
            <th>시간</th>
            <th>구분</th>
            <th>실행 내용</th>
            <th>대상</th>
          </tr>
        </thead>
        <tbody>
          {[...entries].reverse().map((entry) => (
            <tr key={`${entry.tick}:${entry.entity}:${entry.message}`}>
              <td>{entry.tick}</td>
              <td>{entry.time}s</td>
              <td><span className={`trace-kind kind-${entry.category.toLowerCase()}`}>{traceLabel(entry.category)}</span></td>
              <td>{entry.message}</td>
              <td><code>{entry.entity}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ContextContent({ entries, actions, conditions, onChange, onCatalogChange, onEventSend }: {
  entries: BlackboardEntry[];
  actions: ActionDefinition[];
  conditions: ConditionDefinition[];
  onChange: (entries: BlackboardEntry[]) => void;
  onCatalogChange: (actions: ActionDefinition[], conditions: ConditionDefinition[]) => void;
  onEventSend: (eventName: string) => void;
}) {
  const [eventName, setEventName] = useState("");
  const updateEntry = (index: number, patch: Partial<BlackboardEntry>) => onChange(entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry));
  const addEntry = () => {
    const entry = createContextVariableEntry(`새 문맥 값 ${entries.length + 1}`, {
      existingKeys: entries.map((item) => item.key),
      source: "수동 입력",
    });
    onChange([...entries, entry]);
  };
  return (
    <div className="blackboard-editor context-panel" data-testid="context-panel">
      <div className="runtime-event-bar">
        <strong>문맥 · 테스트 값</strong>
        <span className="blackboard-hint">현재값을 바꾸면 시뮬레이션 결과에 바로 반영됩니다.</span>
      </div>
      <div className="runtime-event-bar">
        <strong>테스트 이벤트</strong>
        <input value={eventName} placeholder="예: 플레이어 발견" onChange={(event) => setEventName(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && eventName.trim()) onEventSend(eventName.trim());
        }} />
        <button disabled={!eventName.trim()} onClick={() => onEventSend(eventName.trim())}><Send size={13} /> 보내기</button>
        <span />
        <button onClick={addEntry}><Plus size={13} /> 문맥 값 추가</button>
      </div>
      <div className="drawer-table-wrap">
        <table className="drawer-table blackboard-table">
        <thead>
          <tr>
            <th>표시 이름</th>
            <th>유형</th>
            <th>기본값</th>
            <th>현재값</th>
            <th>출처</th>
            <th aria-label="삭제" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.key}:${index}`}>
              <td>
                <input
                  aria-label="문맥 표시 이름"
                  value={entry.displayName ?? entry.key}
                  onChange={(event) => updateEntry(index, { displayName: event.target.value })}
                  title={`키: ${entry.key}`}
                />
                <details className="context-key-advanced">
                  <summary>키</summary>
                  <input aria-label="문맥 값 키" value={entry.key} onChange={(event) => updateEntry(index, { key: event.target.value })} />
                </details>
              </td>
              <td><select aria-label="문맥 값 유형" value={entry.type} onChange={(event) => updateEntry(index, { type: event.target.value as BlackboardEntry["type"] })}>
                <option>Object</option><option>Float</option><option>Bool</option><option>Int</option><option>Vector</option><option>String</option><option>Enum</option>
              </select></td>
              <td><input aria-label="기본값" value={entry.defaultValue} onChange={(event) => updateEntry(index, { defaultValue: event.target.value })} /></td>
              <td><input className="live-value-input" aria-label="현재값" value={entry.liveValue} onChange={(event) => updateEntry(index, { liveValue: event.target.value })} /></td>
              <td><input aria-label="출처" value={entry.source} onChange={(event) => updateEntry(index, { source: event.target.value })} /></td>
              <td><button aria-label={`${contextEntryLabel(entry)} 삭제`} title="문맥 값 삭제" onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      <details className="context-advanced">
        <summary><Wrench size={13} /> 고급 · 행동·조건 카탈로그</summary>
        <CatalogContent actions={actions} conditions={conditions} onChange={onCatalogChange} />
      </details>
    </div>
  );
}

function CatalogContent({ actions, conditions, onChange }: {
  actions: ActionDefinition[];
  conditions: ConditionDefinition[];
  onChange: (actions: ActionDefinition[], conditions: ConditionDefinition[]) => void;
}) {
  const updateAction = (id: string, patch: Partial<ActionDefinition>) => onChange(actions.map((item) => item.id === id ? { ...item, ...patch } : item), conditions);
  const updateCondition = (id: string, patch: Partial<ConditionDefinition>) => onChange(actions, conditions.map((item) => item.id === id ? { ...item, ...patch } : item));
  return (
    <div className="catalog-editor">
      <section>
        <header><div><strong>상태 행동</strong><span>On Enter·Update·Exit·Can Exit에서 참조</span></div><button onClick={() => onChange([...actions, { id: crypto.randomUUID(), name: "새 행동", parameters: [] }], conditions)}><Plus size={13} /> 행동 추가</button></header>
        <div className="catalog-list">
          {actions.map((action) => <div className="catalog-row" key={action.id}><input aria-label="행동 이름" value={action.name} onChange={(event) => updateAction(action.id, { name: event.target.value })} /><input aria-label="Unity 형식" placeholder="Unity C# Type" value={action.unityType ?? ""} onChange={(event) => updateAction(action.id, { unityType: event.target.value || undefined })} /><input aria-label="Unreal 형식" placeholder="Unreal C++ Type" value={action.unrealType ?? ""} onChange={(event) => updateAction(action.id, { unrealType: event.target.value || undefined })} /><button aria-label={`${action.name} 삭제`} onClick={() => onChange(actions.filter((item) => item.id !== action.id), conditions)}><Trash2 size={13} /></button></div>)}
        </div>
      </section>
      <section>
        <header><div><strong>조건 정의</strong><span>엔진 어댑터가 실제 판정 코드와 연결</span></div><button onClick={() => onChange(actions, [...conditions, { id: crypto.randomUUID(), name: "새 조건", parameters: [], resultType: "Bool" }])}><Plus size={13} /> 조건 추가</button></header>
        <div className="catalog-list">
          {conditions.map((condition) => <div className="catalog-row" key={condition.id}><input aria-label="조건 이름" value={condition.name} onChange={(event) => updateCondition(condition.id, { name: event.target.value })} /><input aria-label="Unity 조건 형식" placeholder="Unity C# Type" value={condition.unityType ?? ""} onChange={(event) => updateCondition(condition.id, { unityType: event.target.value || undefined })} /><input aria-label="Unreal 조건 형식" placeholder="Unreal C++ Type" value={condition.unrealType ?? ""} onChange={(event) => updateCondition(condition.id, { unrealType: event.target.value || undefined })} /><button aria-label={`${condition.name} 삭제`} onClick={() => onChange(actions, conditions.filter((item) => item.id !== condition.id))}><Trash2 size={13} /></button></div>)}
        </div>
      </section>
    </div>
  );
}

function traceLabel(category: TraceEvent["category"]): string {
  const labels: Record<TraceEvent["category"], string> = {
    State: "상태",
    Condition: "조건",
    Action: "행동",
    Hit: "타격",
  };
  return labels[category];
}
