import {
  ArrowRight,
  Braces,
  CircleDot,
  Clock3,
  Link2,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type {
  BlackboardEntry,
  ConditionOperator,
  GraphDefinition,
  GraphEdge,
  TransitionCondition,
  TransitionTriggerType,
} from "../editor/model";
import { getTransitionTriggerType, summarizeTransition } from "../editor/transitionSemantics";

interface TransitionInspectorPanelProps {
  graph: GraphDefinition;
  edge: GraphEdge;
  blackboard: BlackboardEntry[];
  onChange: (edge: GraphEdge) => void;
  onDelete: () => void;
  onClose: () => void;
}

const triggerOptions: Array<{ value: TransitionTriggerType; label: string }> = [
  { value: "always", label: "항상" },
  { value: "condition", label: "조건 충족" },
  { value: "event", label: "이벤트 수신" },
  { value: "completed", label: "상태 완료" },
  { value: "timeout", label: "시간 경과" },
];

const operatorOptions: ConditionOperator[] = ["==", "!=", ">", ">=", "<", "<=", "contains"];

export function TransitionInspectorPanel({
  graph,
  edge,
  blackboard,
  onChange,
  onDelete,
  onClose,
}: TransitionInspectorPanelProps) {
  const source = graph.nodes.find((node) => node.id === edge.source)?.name ?? edge.source;
  const target = graph.nodes.find((node) => node.id === edge.target)?.name ?? edge.target;
  const triggerType = getTransitionTriggerType(edge);
  const update = (patch: Partial<GraphEdge>) => onChange({ ...edge, ...patch });

  const changeTrigger = (nextType: TransitionTriggerType) => {
    update({
      triggerType: nextType,
      label: undefined,
      ...(nextType === "condition" && !edge.conditions?.length
        ? { conditions: [createCondition(blackboard[0]?.key ?? "")] }
        : {}),
    });
  };

  const updateCondition = (conditionId: string, patch: Partial<TransitionCondition>) => {
    update({
      conditions: (edge.conditions ?? []).map((condition) =>
        condition.id === conditionId ? { ...condition, ...patch } : condition,
      ),
    });
  };

  return (
    <aside className="pattern-inspector transition-inspector">
      <header className="inspector-header">
        <div><span>선택 항목</span><strong>전환 속성</strong></div>
        <button aria-label="전환 속성 닫기" title="전환 속성 닫기" onClick={onClose}><X size={16} /></button>
      </header>

      <div className="inspector-scroll">
        <div className="inspector-summary transition-summary">
          <span className="summary-icon"><ArrowRight size={18} /></span>
          <div><strong>{source} → {target}</strong><span>{summarizeTransition(edge)}</span></div>
        </div>

        <InspectorSection title="전환 대상" icon={<Link2 size={14} />}>
          <InspectorField label="출발"><div className="read-only-field">{source}</div></InspectorField>
          <InspectorField label="도착"><div className="read-only-field">{target}</div></InspectorField>
          <InspectorField label="우선순위">
            <input type="number" value={edge.priority ?? 0} onChange={(event) => update({ priority: Number(event.target.value) || 0 })} />
          </InspectorField>
        </InspectorSection>

        <InspectorSection title="실행 시점" icon={<Zap size={14} />}>
          <InspectorField label="전환 방식">
            <select value={triggerType} onChange={(event) => changeTrigger(event.target.value as TransitionTriggerType)}>
              {triggerOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </InspectorField>

          {triggerType === "event" && (
            <InspectorField label="이벤트">
              <input value={edge.eventName ?? edge.trigger ?? edge.label ?? ""} placeholder="예: Enemy.Hit" onChange={(event) => update({ eventName: event.target.value, trigger: undefined, label: undefined })} />
            </InspectorField>
          )}

          {triggerType === "timeout" && (
            <InspectorField label="대기 시간">
              <div className="unit-input"><input type="number" min={0} value={edge.timeoutMs ?? 0} onChange={(event) => update({ timeoutMs: Math.max(0, Number(event.target.value) || 0) })} /><span>ms</span></div>
            </InspectorField>
          )}

          {triggerType === "condition" && (
            <>
              <InspectorField label="조건 결합">
                <select value={edge.conditionMode ?? "all"} onChange={(event) => update({ conditionMode: event.target.value as "all" | "any" })}>
                  <option value="all">모두 만족 (AND)</option>
                  <option value="any">하나 이상 (OR)</option>
                </select>
              </InspectorField>
              <div className="transition-condition-list">
                {(edge.conditions ?? []).map((condition) => (
                  <div className="transition-condition-editor" key={condition.id}>
                    <select aria-label="블랙보드 키" value={condition.key} onChange={(event) => updateCondition(condition.id, { key: event.target.value })}>
                      <option value="">변수 선택</option>
                      {blackboard.map((entry) => <option value={entry.key} key={entry.key}>{entry.key}</option>)}
                    </select>
                    <select aria-label="비교 연산자" value={condition.operator} onChange={(event) => updateCondition(condition.id, { operator: event.target.value as ConditionOperator })}>
                      {operatorOptions.map((operator) => <option value={operator} key={operator}>{operator}</option>)}
                    </select>
                    <input aria-label="비교 값" value={condition.value} placeholder="값" onChange={(event) => updateCondition(condition.id, { value: event.target.value })} />
                    <button aria-label="조건 삭제" title="조건 삭제" onClick={() => update({ conditions: edge.conditions?.filter((item) => item.id !== condition.id) })}><X size={13} /></button>
                  </div>
                ))}
              </div>
              <button className="inspector-add-button" onClick={() => update({ conditions: [...(edge.conditions ?? []), createCondition(blackboard[0]?.key ?? "")] })}>
                <Plus size={13} /> 조건 추가
              </button>
              {blackboard.length === 0 && <p className="inspector-help">블랙보드 패널에서 변수를 먼저 추가하세요.</p>}
            </>
          )}
        </InspectorSection>

        <InspectorSection title="전환 정책" icon={<Clock3 size={14} />}>
          <InspectorField label="인터럽트">
            <select value={edge.interruptPolicy ?? "after-action"} onChange={(event) => update({ interruptPolicy: event.target.value as GraphEdge["interruptPolicy"] })}>
              <option value="after-action">현재 행동 완료 후</option>
              <option value="source">출발 상태 중단</option>
              <option value="immediate">즉시 전환</option>
            </select>
          </InspectorField>
          <InspectorField label="최소 체류 시간">
            <div className="unit-input"><input type="number" min={0} value={edge.minimumStateTimeMs ?? 0} onChange={(event) => update({ minimumStateTimeMs: Math.max(0, Number(event.target.value) || 0) })} /><span>ms</span></div>
          </InspectorField>
          <InspectorField label="같은 상태 재진입">
            <select value={edge.reenter ? "yes" : "no"} onChange={(event) => update({ reenter: event.target.value === "yes" })}>
              <option value="no">상태 유지</option><option value="yes">나갔다 다시 진입</option>
            </select>
          </InspectorField>
          <div className="transition-policy-note"><Braces size={13} /><span>엔진 변환 시 Unity Exit Time과 Unreal Transition Trigger에 맞게 변환됩니다.</span></div>
        </InspectorSection>

        <section className="inspector-danger-zone">
          <button onClick={onDelete}><Trash2 size={14} /> 전환 삭제</button>
        </section>
      </div>
    </aside>
  );
}

function createCondition(key: string): TransitionCondition {
  return { id: crypto.randomUUID(), key, operator: "==", value: "true" };
}

function InspectorSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="inspector-section"><header><CircleDot size={13} />{icon}<strong>{title}</strong></header><div className="inspector-section-body">{children}</div></section>;
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="inspector-field"><span>{label}</span>{children}</label>;
}
