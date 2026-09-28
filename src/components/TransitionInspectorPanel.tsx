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
import { useState } from "react";
import {
  FLOW_CONDITION_PROMPT,
  contextEntryLabel,
  createContextVariableEntry,
} from "../editor/authoringFlow";
import type {
  BlackboardEntry,
  ConditionOperator,
  GraphDefinition,
  GraphEdge,
  TransitionCondition,
  TransitionTriggerType,
} from "../editor/model";
import { getTransitionTriggerType, operatorLabel, summarizeTransition } from "../editor/transitionSemantics";

interface TransitionInspectorPanelProps {
  graph: GraphDefinition;
  edge: GraphEdge;
  blackboard: BlackboardEntry[];
  onChange: (edge: GraphEdge) => void;
  onDelete: () => void;
  onClose: () => void;
  onCreateContextVariable?: (displayName: string, key?: string) => BlackboardEntry;
}

const triggerOptions: Array<{ value: TransitionTriggerType; label: string }> = [
  { value: "always", label: "항상" },
  { value: "condition", label: "조건 충족" },
  { value: "event", label: "이벤트 수신" },
  { value: "completed", label: "행동 완료" },
  { value: "timeout", label: "시간 경과" },
];

const operatorOptions: ConditionOperator[] = ["==", "!=", ">", ">=", "<", "<=", "contains"];

function operatorSelectLabel(operator: ConditionOperator): string {
  return operatorLabel(operator);
}

export function TransitionInspectorPanel({
  graph,
  edge,
  blackboard,
  onChange,
  onDelete,
  onClose,
  onCreateContextVariable,
}: TransitionInspectorPanelProps) {
  const sourceNode = graph.nodes.find((node) => node.id === edge.source);
  const targetNode = graph.nodes.find((node) => node.id === edge.target);
  const source = sourceNode?.name ?? edge.source;
  const target = targetNode?.name ?? edge.target;
  const isAnywhere = sourceNode?.kind === "any";
  const flowTitle = isAnywhere ? "어떤 상황에서도" : `${source} → ${target}`;
  const triggerType = getTransitionTriggerType(edge);
  const update = (patch: Partial<GraphEdge>) => onChange({ ...edge, ...patch });
  const [creatingContext, setCreatingContext] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [showAdvancedKey, setShowAdvancedKey] = useState(false);
  const [newKey, setNewKey] = useState("");

  const changeTrigger = (nextType: TransitionTriggerType) => {
    update({
      triggerType: nextType,
      label: undefined,
      ...(nextType === "condition" && !edge.conditions?.length
        ? { conditions: [createCondition("")] }
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

  const submitNewContext = (conditionId?: string) => {
    const displayName = newDisplayName.trim();
    if (!displayName) return;
    const advancedKey = showAdvancedKey && newKey.trim() ? newKey.trim() : undefined;
    const created = onCreateContextVariable
      ? onCreateContextVariable(displayName, advancedKey)
      : createContextVariableEntry(displayName, {
          key: advancedKey,
          existingKeys: blackboard.map((entry) => entry.key),
        });
    const key = created.key;
    if (conditionId) {
      updateCondition(conditionId, { key });
    } else {
      update({
        triggerType: "condition",
        conditions: [...(edge.conditions ?? []), createCondition(key)],
      });
    }
    setCreatingContext(false);
    setNewDisplayName("");
    setNewKey("");
    setShowAdvancedKey(false);
  };

  return (
    <aside className="pattern-inspector transition-inspector">
      <header className="inspector-header">
        <div><span>선택 항목</span><strong>흐름 조건</strong></div>
        <button aria-label="흐름 조건 닫기" title="흐름 조건 닫기" onClick={onClose}><X size={16} /></button>
      </header>

      <div className="inspector-scroll">
        <div className="inspector-summary transition-summary">
          <span className="summary-icon"><ArrowRight size={18} /></span>
          <div>
            <strong>{flowTitle}</strong>
            <span>{isAnywhere ? `${ANYWHERE_HINT} · ${summarizeTransition(edge)}` : summarizeTransition(edge)}</span>
          </div>
        </div>

        <InspectorSection title="흐름" icon={<Link2 size={14} />}>
          <InspectorField label="출발">
            <div className="read-only-field">{isAnywhere ? "어떤 상황에서도" : source}</div>
          </InspectorField>
          <InspectorField label="도착"><div className="read-only-field">{target}</div></InspectorField>
          <InspectorField label="우선순위">
            <input type="number" value={edge.priority ?? 0} onChange={(event) => update({ priority: Number(event.target.value) || 0 })} />
          </InspectorField>
        </InspectorSection>

        <InspectorSection title={FLOW_CONDITION_PROMPT} icon={<Zap size={14} />}>
          <p className="inspector-help flow-condition-lead">
            {isAnywhere
              ? "어느 상황에 있어도 이 조건이 맞으면 도착 상황으로 이동합니다."
              : "이 흐름을 언제 탈지 적어 주세요. 예: 가까움 = 참, 공격받음 = 참"}
          </p>
          <InspectorField label="조건 종류">
            <select value={triggerType} onChange={(event) => changeTrigger(event.target.value as TransitionTriggerType)}>
              {triggerOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </InspectorField>

          {triggerType === "event" && (
            <InspectorField label="이벤트">
              <input value={edge.eventName ?? edge.trigger ?? edge.label ?? ""} placeholder="예: 플레이어 발견" onChange={(event) => update({ eventName: event.target.value, trigger: undefined, label: undefined })} />
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
                  <div className="condition-builder-row" key={condition.id}>
                    <select
                      aria-label="문맥 값"
                      value={condition.key}
                      onChange={(event) => {
                        if (event.target.value === "__create__") {
                          setCreatingContext(true);
                          return;
                        }
                        updateCondition(condition.id, { key: event.target.value });
                      }}
                    >
                      <option value="">문맥 값 선택</option>
                      {blackboard.map((entry) => (
                        <option value={entry.key} key={entry.key}>{contextEntryLabel(entry)}</option>
                      ))}
                      <option value="__create__">＋ 새 문맥 값 만들기…</option>
                    </select>
                    <select aria-label="비교" value={condition.operator} onChange={(event) => updateCondition(condition.id, { operator: event.target.value as ConditionOperator })}>
                      {operatorOptions.map((operator) => <option value={operator} key={operator}>{operatorSelectLabel(operator)}</option>)}
                    </select>
                    <input aria-label="값" value={condition.value} placeholder="예: true" onChange={(event) => updateCondition(condition.id, { value: event.target.value })} />
                    <button aria-label="조건 삭제" title="조건 삭제" onClick={() => update({ conditions: edge.conditions?.filter((item) => item.id !== condition.id) })}><X size={13} /></button>
                  </div>
                ))}
              </div>

              {creatingContext && (
                <div className="inline-context-create" data-testid="inline-context-create">
                  <strong>새 문맥 값 만들기</strong>
                  <label className="inspector-field">
                    <span>표시 이름</span>
                    <input
                      autoFocus
                      aria-label="문맥 표시 이름"
                      placeholder="예: 가까움, 공격받음"
                      value={newDisplayName}
                      onChange={(event) => setNewDisplayName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          const empty = (edge.conditions ?? []).find((item) => !item.key);
                          submitNewContext(empty?.id);
                        }
                      }}
                    />
                  </label>
                  <details
                    className="inspector-advanced"
                    open={showAdvancedKey}
                    onToggle={(event) => setShowAdvancedKey((event.target as HTMLDetailsElement).open)}
                  >
                    <summary>고급 · 키</summary>
                    <div className="inspector-advanced-body">
                      <label className="inspector-field">
                        <span>키 (자동 생성 가능)</span>
                        <input
                          aria-label="문맥 키"
                          placeholder="비우면 표시 이름으로 만듭니다"
                          value={newKey}
                          onChange={(event) => setNewKey(event.target.value)}
                        />
                      </label>
                    </div>
                  </details>
                  <div className="inline-context-actions">
                    <button type="button" className="secondary-button" onClick={() => { setCreatingContext(false); setNewDisplayName(""); }}>취소</button>
                    <button
                      type="button"
                      className="primary-button"
                      data-testid="confirm-new-context"
                      disabled={!newDisplayName.trim()}
                      onClick={() => {
                        const empty = (edge.conditions ?? []).find((item) => !item.key);
                        submitNewContext(empty?.id);
                      }}
                    >
                      만들기
                    </button>
                  </div>
                </div>
              )}

              {!creatingContext && (
                <button
                  type="button"
                  className="inspector-add-button"
                  data-testid="create-context-inline"
                  onClick={() => setCreatingContext(true)}
                >
                  <Plus size={13} /> 새 문맥 값 만들기
                </button>
              )}

              <p className="inspector-help">예: 가까움 = 참 — 캔버스에도 같은 문장으로 표시됩니다.</p>
              <details className="inspector-advanced">
                <summary>고급 · 원문 조건</summary>
                <div className="inspector-advanced-body">
                  <InspectorField label="원문 (선택)">
                    <input value={edge.guard ?? ""} placeholder="예: distance < 5" onChange={(event) => update({ guard: event.target.value || undefined })} />
                  </InspectorField>
                </div>
              </details>
              <button className="inspector-add-button" onClick={() => update({ conditions: [...(edge.conditions ?? []), createCondition(blackboard[0]?.key ?? "")] })}>
                <Plus size={13} /> 조건 추가
              </button>
              {blackboard.length === 0 && !creatingContext && (
                <p className="inspector-help">문맥 값이 없습니다. 「새 문맥 값 만들기」로 바로 추가하세요.</p>
              )}
            </>
          )}
        </InspectorSection>

        <InspectorSection title="고급 정책" icon={<Clock3 size={14} />}>
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
          <button onClick={onDelete}><Trash2 size={14} /> 흐름 삭제</button>
        </section>
      </div>
    </aside>
  );
}

const ANYWHERE_HINT = "어느 상황에서나";

function createCondition(key: string): TransitionCondition {
  return { id: crypto.randomUUID(), key, operator: "==", value: "true" };
}

function InspectorSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="inspector-section"><header><CircleDot size={13} />{icon}<strong>{title}</strong></header><div className="inspector-section-body">{children}</div></section>;
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="inspector-field"><span>{label}</span>{children}</label>;
}
