import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronDown,
  ListTree,
  Plus,
  Send,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ActionDefinition, BlackboardEntry, ConditionDefinition, DrawerTab, TraceEvent } from "../editor/model";
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
  onBlackboardChange: (entries: BlackboardEntry[]) => void;
  onCatalogChange: (actions: ActionDefinition[], conditions: ConditionDefinition[]) => void;
  onEventSend: (eventName: string) => void;
  onSeek: (tick: number) => void;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
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
          active={activeTab === "validation"}
          label="검증"
          count={issues.length}
          icon={<AlertTriangle size={14} />}
          onClick={() => onTabChange("validation")}
        />
        <DrawerButton
          active={activeTab === "catalog"}
          label="행동·조건"
          count={actions.length + conditions.length}
          icon={<Wrench size={14} />}
          onClick={() => onTabChange("catalog")}
        />
        <DrawerButton
          active={activeTab === "trace"}
          label="실행 기록"
          count={trace.length}
          icon={<ListTree size={14} />}
          onClick={() => onTabChange("trace")}
        />
        <DrawerButton
          active={activeTab === "blackboard"}
          label="블랙보드"
          count={blackboard.length}
          icon={<Braces size={14} />}
          onClick={() => onTabChange("blackboard")}
        />
        <span className="drawer-spacer" />
        <div className="drawer-engine">
          <span>{engine}</span>
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
          {activeTab === "validation" && <ValidationContent issues={issues} />}
          {activeTab === "trace" && <TraceContent entries={trace} tick={tick} coverage={coverage} stateDurationsMs={stateDurationsMs} failedConditions={failedConditions} onSeek={onSeek} />}
          {activeTab === "blackboard" && <BlackboardContent entries={blackboard} onChange={onBlackboardChange} onEventSend={onEventSend} />}
          {activeTab === "catalog" && <CatalogContent actions={actions} conditions={conditions} onChange={onCatalogChange} />}
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

function ValidationContent({ issues }: { issues: GraphIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="drawer-empty valid">
        <CheckCircle2 size={24} />
        <div>
          <strong>구조 검증을 통과했습니다.</strong>
          <span>시작 상태, 연결, 계층과 순환 구조에 문제가 없습니다.</span>
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
      <div className="trace-timeline"><strong>결정적 재생</strong><input aria-label="실행 시점" type="range" min={0} max={Math.max(0, tick)} value={tick} onChange={(event) => onSeek(Number(event.target.value))} /><span>{tick} 틱</span><b>방문 {Object.values(coverage).reduce((sum, value) => sum + value, 0)}회 · 누적 {Math.round(Object.values(stateDurationsMs).reduce((sum, value) => sum + value, 0))}ms</b></div>
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

function BlackboardContent({ entries, onChange, onEventSend }: {
  entries: BlackboardEntry[];
  onChange: (entries: BlackboardEntry[]) => void;
  onEventSend: (eventName: string) => void;
}) {
  const [eventName, setEventName] = useState("");
  const updateEntry = (index: number, patch: Partial<BlackboardEntry>) => onChange(entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry));
  const addEntry = () => {
    let suffix = entries.length + 1;
    while (entries.some((entry) => entry.key === `NewKey${suffix}`)) suffix += 1;
    onChange([...entries, { key: `NewKey${suffix}`, type: "Bool", defaultValue: "false", liveValue: "false", source: "수동 입력" }]);
  };
  return (
    <div className="blackboard-editor">
      <div className="runtime-event-bar">
        <strong>테스트 이벤트</strong>
        <input value={eventName} placeholder="예: Enemy.Hit" onChange={(event) => setEventName(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && eventName.trim()) onEventSend(eventName.trim());
        }} />
        <button disabled={!eventName.trim()} onClick={() => onEventSend(eventName.trim())}><Send size={13} /> 보내기</button>
        <span />
        <button onClick={addEntry}><Plus size={13} /> 변수 추가</button>
      </div>
      <div className="drawer-table-wrap">
        <table className="drawer-table blackboard-table">
        <thead>
          <tr>
            <th>키</th>
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
              <td><input aria-label="블랙보드 키" value={entry.key} onChange={(event) => updateEntry(index, { key: event.target.value })} /></td>
              <td><select aria-label="블랙보드 유형" value={entry.type} onChange={(event) => updateEntry(index, { type: event.target.value as BlackboardEntry["type"] })}>
                <option>Object</option><option>Float</option><option>Bool</option><option>Int</option><option>Vector</option><option>String</option><option>Enum</option>
              </select></td>
              <td><input aria-label="기본값" value={entry.defaultValue} onChange={(event) => updateEntry(index, { defaultValue: event.target.value })} /></td>
              <td><input className="live-value-input" aria-label="현재값" value={entry.liveValue} onChange={(event) => updateEntry(index, { liveValue: event.target.value })} /></td>
              <td><input aria-label="출처" value={entry.source} onChange={(event) => updateEntry(index, { source: event.target.value })} /></td>
              <td><button aria-label={`${entry.key} 삭제`} title="변수 삭제" onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
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
        <header><div><strong>상태 행동</strong><span>On Enter·Update·Exit·Can Exit에서 재사용</span></div><button onClick={() => onChange([...actions, { id: crypto.randomUUID(), name: "새 행동", parameters: [] }], conditions)}><Plus size={13} /> 행동 추가</button></header>
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
    Hit: "피격",
  };
  return labels[category];
}
