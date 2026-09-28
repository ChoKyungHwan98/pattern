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
import {
  EVAL_STYLE_LABELS,
  HARD_REQUIREMENT_OPERATOR_LABELS,
  INFLUENCE_LABELS,
  candidateActionIdsFromCandidates,
  createConsideration,
  createDecisionCandidate,
  createHardRequirement,
  domainEntityLabel,
  formatCandidateCriteriaBrief,
  formatConsiderationBrief,
  formatRangeDisplay,
  resolveConsiderationRange,
  normalizeDecisionCandidates,
  resolveDomainEntityKind,
  withInternalScoring,
  type ConsiderationEvalStyle,
  type DecisionCandidate,
  type DecisionKind,
  type HardRequirementOperator,
  type InfluenceLevel,
  type NodeDomainPayload,
} from "../editor/domain";
import {
  behaviorEntityLabel,
  exitReturnEdges,
  interruptEdges,
} from "../editor/behaviorUi";
import { summarizeTransition } from "../editor/transitionSemantics";
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
  const entityKind = resolveDomainEntityKind(selectedNode);
  const domain: NodeDomainPayload | undefined = selectedNode.domain ?? (entityKind ? { entityKind } : undefined);
  const updateDomain = (patch: Partial<NodeDomainPayload>) => {
    if (!entityKind) return;
    const nextDomain: NodeDomainPayload = { ...(domain ?? { entityKind }), entityKind, ...patch };
    updateNode({
      domain: nextDomain,
      subtitle: domainEntityLabel(entityKind),
      action: patch.executeAction !== undefined ? (patch.executeAction || undefined) : selectedNode.action,
    });
  };

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
            <span>{nodeTypeLabel(selectedNode)}</span>
          </div>
          <span className={`runtime-chip state-${runtimeNodeState ?? "ready"}`}>
            {runtimeLabel(runtimeState, runtimeNodeState)}
          </span>
        </div>

        <InspectorSection title="기본 정보" icon={<CircleDot size={14} />}>
          <InspectorField label="이름">
            <input data-node-name-input value={selectedNode.name} onChange={(event) => onNodeNameChange(event.target.value)} />
          </InspectorField>
          {parentName && (
            <InspectorField label="상위 범위">
              <div className="read-only-field with-icon">
                <Network size={12} />
                {parentName}
              </div>
            </InspectorField>
          )}
          {graphMode === "state-machine" && ["state", "submachine"].includes(selectedNode.kind) && (
            <InspectorField label="시작 상황">
              <button className="read-only-field inspector-inline-action" disabled={isDefault} onClick={() => onSetDefaultState(selectedNode.id)}>{isDefault ? "현재 시작 상황" : "시작 상황으로 지정"}</button>
            </InspectorField>
          )}
        </InspectorSection>

        {entityKind === "action" && domain && (
          <InspectorSection title="행동" icon={<Braces size={14} />}>
            <InspectorField label="행동 의도">
              <textarea
                className="description-field"
                value={domain.intent ?? selectedNode.description ?? ""}
                placeholder="예: 경계를 유지하며 접근한다"
                onChange={(event) => {
                  const value = event.target.value || undefined;
                  if (!entityKind) return;
                  onNodeChange({
                    ...selectedNode,
                    description: value,
                    subtitle: domainEntityLabel(entityKind),
                    domain: { ...(domain ?? { entityKind }), entityKind, intent: value },
                  });
                }}
              />
            </InspectorField>
            <InspectorField label="실행 행동">
              <input
                value={domain.executeAction ?? selectedNode.action ?? ""}
                placeholder="예: Play_Alert, MoveToCover"
                onChange={(event) => updateDomain({ executeAction: event.target.value || undefined })}
              />
            </InspectorField>
            <InspectorField label="완료 조건">
              <input
                value={domain.completionCondition ?? ""}
                placeholder="예: 애니메이션 종료, 목표 도달"
                onChange={(event) => updateDomain({ completionCondition: event.target.value || undefined })}
              />
            </InspectorField>
            <InspectorField label="중단 가능 여부">
              <select
                value={(domain.interruptible ?? true) ? "yes" : "no"}
                onChange={(event) => updateDomain({ interruptible: event.target.value === "yes" })}
              >
                <option value="yes">중단 가능</option>
                <option value="no">완료까지 유지</option>
              </select>
            </InspectorField>
          </InspectorSection>
        )}

        {entityKind === "decision" && domain && (
          <InspectorSection title="판단" icon={<Braces size={14} />} count={normalizeDecisionCandidates(domain).length}>
            <InspectorField label="판단 방식">
              <select
                value={domain.decisionKind ?? "SELECTOR"}
                onChange={(event) => updateDomain({ decisionKind: event.target.value as DecisionKind })}
              >
                <option value="SELECTOR">선택</option>
                <option value="UTILITY">고려 요인 비교</option>
              </select>
            </InspectorField>
            <p className="inspector-help">
              흐름 조건(상황→…)은 캔버스 연결선에서 읽습니다. 아래 점수는 후보별 고려 요인이며, 최종 선택·실시간 점수는 시뮬에서만 계산합니다.
            </p>
            <div className="decision-candidate-editor">
              {normalizeDecisionCandidates(domain).map((candidate, candidateIndex) => {
                const candidates = normalizeDecisionCandidates(domain);
                const patchCandidates = (next: DecisionCandidate[]) => {
                  updateDomain({
                    candidates: next,
                    candidateActionIds: candidateActionIdsFromCandidates(next),
                  });
                };
                const updateCandidate = (patch: Partial<DecisionCandidate>) => {
                  const next = candidates.map((item, index) =>
                    index === candidateIndex ? { ...item, ...patch } : item,
                  );
                  patchCandidates(next);
                };
                return (
                  <article className="decision-candidate-card" key={candidate.id}>
                    <header className="decision-candidate-card-header">
                      <strong>후보 {candidateIndex + 1}</strong>
                      <button
                        type="button"
                        aria-label={`후보 ${candidateIndex + 1} 삭제`}
                        onClick={() => patchCandidates(candidates.filter((_, index) => index !== candidateIndex))}
                      >
                        <Trash2 size={12} />
                      </button>
                    </header>
                    <InspectorField label="행동 / 상황">
                      <select
                        aria-label={`후보 ${candidateIndex + 1} 행동`}
                        value={candidate.actionNodeId}
                        onChange={(event) => updateCandidate({ actionNodeId: event.target.value })}
                      >
                        <option value="">선택</option>
                        {graph.nodes
                          .filter((node) => node.id !== selectedNode.id && !["entry", "any", "exit"].includes(node.kind))
                          .map((node) => (
                            <option value={node.id} key={node.id}>{node.name}</option>
                          ))}
                      </select>
                    </InspectorField>
                    <p className="decision-candidate-brief">{formatCandidateCriteriaBrief(candidate)}</p>

                    <div className="decision-subblock">
                      <div className="decision-subblock-title">
                        <span>하드 조건 (미충족 시 제외)</span>
                        <button
                          type="button"
                          className="inspector-add-button compact"
                          onClick={() => updateCandidate({
                            hardRequirements: [...candidate.hardRequirements, createHardRequirement()],
                          })}
                        >
                          <Plus size={12} /> 추가
                        </button>
                      </div>
                      {candidate.hardRequirements.length === 0 && (
                        <p className="inspector-help">예: CooldownReady == false 이면 공격 제외</p>
                      )}
                      {candidate.hardRequirements.map((requirement, reqIndex) => (
                        <div className="hard-requirement-row" key={requirement.id}>
                          <input
                            aria-label={`하드 조건 변수 ${reqIndex + 1}`}
                            placeholder="변수"
                            value={requirement.variableKey}
                            list="decision-variable-options"
                            onChange={(event) => {
                              const hardRequirements = candidate.hardRequirements.map((item, index) =>
                                index === reqIndex ? { ...item, variableKey: event.target.value } : item,
                              );
                              updateCandidate({ hardRequirements });
                            }}
                          />
                          <select
                            aria-label={`하드 조건 연산 ${reqIndex + 1}`}
                            value={requirement.operator}
                            onChange={(event) => {
                              const hardRequirements = candidate.hardRequirements.map((item, index) =>
                                index === reqIndex
                                  ? { ...item, operator: event.target.value as HardRequirementOperator }
                                  : item,
                              );
                              updateCandidate({ hardRequirements });
                            }}
                          >
                            {(Object.keys(HARD_REQUIREMENT_OPERATOR_LABELS) as HardRequirementOperator[]).map((op) => (
                              <option value={op} key={op}>{HARD_REQUIREMENT_OPERATOR_LABELS[op]}</option>
                            ))}
                          </select>
                          {requirement.operator !== "is_true" && requirement.operator !== "is_false" ? (
                            <input
                              aria-label={`하드 조건 값 ${reqIndex + 1}`}
                              placeholder="값"
                              value={requirement.value ?? ""}
                              onChange={(event) => {
                                const hardRequirements = candidate.hardRequirements.map((item, index) =>
                                  index === reqIndex ? { ...item, value: event.target.value } : item,
                                );
                                updateCandidate({ hardRequirements });
                              }}
                            />
                          ) : (
                            <span className="hard-requirement-spacer" />
                          )}
                          <button
                            type="button"
                            aria-label="하드 조건 삭제"
                            onClick={() => updateCandidate({
                              hardRequirements: candidate.hardRequirements.filter((_, index) => index !== reqIndex),
                            })}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="decision-subblock">
                      <div className="decision-subblock-title">
                        <span>고려 요인 (점수 영향)</span>
                        <button
                          type="button"
                          className="inspector-add-button compact"
                          onClick={() => updateCandidate({
                            considerations: [
                              ...candidate.considerations,
                              withInternalScoring(createConsideration({ influence: "medium" })),
                            ],
                          })}
                        >
                          <Plus size={12} /> 추가
                        </button>
                      </div>
                      {candidate.considerations.length === 0 && (
                        <p className="inspector-help">예: 플레이어 거리 → 0~10m · 가까울수록 · 영향도 높음</p>
                      )}
                      {candidate.considerations.map((consideration, conIndex) => (
                        <div className="consideration-card" key={consideration.id}>
                          <div className="consideration-grid">
                            <label>
                              <span>변수</span>
                              <input
                                aria-label={`고려 요인 변수 ${conIndex + 1}`}
                                placeholder="예: 플레이어 거리"
                                value={consideration.variableKey}
                                list="decision-variable-options"
                                onChange={(event) => {
                                  const considerations = candidate.considerations.map((item, index) =>
                                    index === conIndex
                                      ? withInternalScoring({ ...item, variableKey: event.target.value })
                                      : item,
                                  );
                                  updateCandidate({ considerations });
                                }}
                              />
                            </label>
                            <label>
                              <span>평가 방식</span>
                              <select
                                aria-label={`고려 요인 평가 ${conIndex + 1}`}
                                value={consideration.evalStyle}
                                onChange={(event) => {
                                  const considerations = candidate.considerations.map((item, index) =>
                                    index === conIndex
                                      ? withInternalScoring({
                                          ...item,
                                          evalStyle: event.target.value as ConsiderationEvalStyle,
                                        })
                                      : item,
                                  );
                                  updateCandidate({ considerations });
                                }}
                              >
                                {(Object.keys(EVAL_STYLE_LABELS) as ConsiderationEvalStyle[]).map((style) => (
                                  <option value={style} key={style}>{EVAL_STYLE_LABELS[style]}</option>
                                ))}
                              </select>
                            </label>
                            <label className="consideration-range-fields">
                              <span>범위 / 기준 <em>{formatRangeDisplay(resolveConsiderationRange(consideration)) || "미설정"}</em></span>
                              <div className="consideration-range-inputs">
                                <input
                                  aria-label={`고려 요인 최소 ${conIndex + 1}`}
                                  type="number"
                                  placeholder="min"
                                  value={resolveConsiderationRange(consideration)?.min ?? ""}
                                  onChange={(event) => {
                                    const prev = resolveConsiderationRange(consideration) ?? { min: 0, max: 1 };
                                    const min = event.target.value === "" ? 0 : Number(event.target.value);
                                    const considerations = candidate.considerations.map((item, index) =>
                                      index === conIndex
                                        ? withInternalScoring({
                                            ...item,
                                            range: { ...prev, min: Number.isFinite(min) ? min : prev.min },
                                            rangeLabel: undefined,
                                          })
                                        : item,
                                    );
                                    updateCandidate({ considerations });
                                  }}
                                />
                                <span>~</span>
                                <input
                                  aria-label={`고려 요인 최대 ${conIndex + 1}`}
                                  type="number"
                                  placeholder="max"
                                  value={resolveConsiderationRange(consideration)?.max ?? ""}
                                  onChange={(event) => {
                                    const prev = resolveConsiderationRange(consideration) ?? { min: 0, max: 1 };
                                    const max = event.target.value === "" ? 1 : Number(event.target.value);
                                    const considerations = candidate.considerations.map((item, index) =>
                                      index === conIndex
                                        ? withInternalScoring({
                                            ...item,
                                            range: { ...prev, max: Number.isFinite(max) ? max : prev.max },
                                            rangeLabel: undefined,
                                          })
                                        : item,
                                    );
                                    updateCandidate({ considerations });
                                  }}
                                />
                                <input
                                  aria-label={`고려 요인 단위 ${conIndex + 1}`}
                                  placeholder="단위"
                                  value={resolveConsiderationRange(consideration)?.unit ?? ""}
                                  onChange={(event) => {
                                    const prev = resolveConsiderationRange(consideration) ?? { min: 0, max: 1 };
                                    const unit = event.target.value.trim() || undefined;
                                    const considerations = candidate.considerations.map((item, index) =>
                                      index === conIndex
                                        ? withInternalScoring({
                                            ...item,
                                            range: { ...prev, unit },
                                            rangeLabel: undefined,
                                          })
                                        : item,
                                    );
                                    updateCandidate({ considerations });
                                  }}
                                />
                              </div>
                            </label>
                            <label>
                              <span>영향도</span>
                              <select
                                aria-label={`고려 요인 영향도 ${conIndex + 1}`}
                                value={consideration.influence}
                                onChange={(event) => {
                                  const considerations = candidate.considerations.map((item, index) =>
                                    index === conIndex
                                      ? withInternalScoring({
                                          ...item,
                                          influence: event.target.value as InfluenceLevel,
                                        })
                                      : item,
                                  );
                                  updateCandidate({ considerations });
                                }}
                              >
                                {(Object.keys(INFLUENCE_LABELS) as InfluenceLevel[]).map((level) => (
                                  <option value={level} key={level}>{INFLUENCE_LABELS[level]}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="consideration-card-footer">
                            <small>{formatConsiderationBrief(consideration)}</small>
                            <button
                              type="button"
                              aria-label="고려 요인 삭제"
                              onClick={() => updateCandidate({
                                considerations: candidate.considerations.filter((_, index) => index !== conIndex),
                              })}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <button
              className="inspector-add-button"
              type="button"
              onClick={() => {
                const next = [
                  ...normalizeDecisionCandidates(domain),
                  createDecisionCandidate(),
                ];
                updateDomain({
                  candidates: next,
                  candidateActionIds: candidateActionIdsFromCandidates(next),
                });
              }}
            >
              <Plus size={13} /> 후보 추가
            </button>
            <datalist id="decision-variable-options">
              {/* Common sample / Cinder keys; live blackboard is edited elsewhere. */}
              <option value="플레이어 거리" />
              <option value="아군 수" />
              <option value="내 HP" />
              <option value="CooldownReady" />
              <option value="DistanceToTarget" />
              <option value="HasLineOfSight" />
            </datalist>
          </InspectorSection>
        )}

        {entityKind === "state" && domain && (
          <InspectorSection title="상황" icon={<Braces size={14} />}>
            <InspectorField label="설명">
              <textarea
                className="description-field"
                value={selectedNode.description ?? ""}
                placeholder="이 상황에서 캐릭터가 처한 국면을 적으세요."
                onChange={(event) => updateNode({ description: event.target.value || undefined })}
              />
            </InspectorField>
            <InspectorField label="대표 행동">
              <input
                value={selectedNode.action ?? ""}
                placeholder="선택"
                onChange={(event) => updateNode({ action: event.target.value || undefined })}
              />
            </InspectorField>
          </InspectorSection>
        )}

        {graphMode === "state-machine" && !["entry", "any", "exit", "submachine"].includes(selectedNode.kind) && entityKind === "state" && (
          <InspectorSection title="상황 행동" icon={<Braces size={14} />} count={selectedNode.actions?.length ?? 0}>
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
            <button className="inspector-add-button" onClick={() => updateNode({ actions: [...(selectedNode.actions ?? []), { id: crypto.randomUUID(), phase: "enter", actionId: actionDefinitions[0]?.id ?? "", parameters: {} }] })}><Plus size={13} /> 상황 행동 추가</button>
            {!actionDefinitions.length && <p className="inspector-help">하단 변수·카탈로그에서 행동 정의를 먼저 추가하세요.</p>}
          </InspectorSection>
        )}

        {childScope && (
          <InspectorSection title="행동 묶음" icon={<Network size={14} />}>
            <InspectorField label="이름"><input value={childScope.name} onChange={(event) => onScopeChange(childScope.id, { name: event.target.value })} /></InspectorField>
            <InspectorField label="재진입 기록"><select value={childScope.history} onChange={(event) => onScopeChange(childScope.id, { history: event.target.value as StateMachineScope["history"] })}><option value="none">초기 상태부터</option><option value="shallow">얕은 기록</option><option value="deep">깊은 기록</option></select></InspectorField>
            <InspectorField label="실행 방식"><select value={childScope.regionMode} onChange={(event) => onScopeChange(childScope.id, { regionMode: event.target.value as StateMachineScope["regionMode"] })}><option value="exclusive">단일 상태</option><option value="parallel">병렬 리전</option></select></InspectorField>
            <button className="inspector-add-button" onClick={() => onScopeOpen(childScope.id)}>행동 묶음 열기</button>
          </InspectorSection>
        )}

        <InspectorSection
          title="흐름"
          icon={<Link2 size={14} />}
          count={incoming.length + outgoing.length}
        >
          <div className="transition-list">
            {outgoing.map((edge) => (
              <TransitionRow
                key={edge.id}
                direction="나감"
                name={graph.nodes.find((node) => node.id === edge.target)?.name ?? edge.target}
                condition={summarizeTransition(edge)}
                priority={edge.priority}
                onClick={() => onTransitionSelect(edge.id)}
              />
            ))}
            {incoming.map((edge) => (
              <TransitionRow
                key={edge.id}
                direction="들어옴"
                name={graph.nodes.find((node) => node.id === edge.source)?.name ?? edge.source}
                condition={summarizeTransition(edge)}
                priority={edge.priority}
                onClick={() => onTransitionSelect(edge.id)}
              />
            ))}
            {incoming.length + outgoing.length === 0 && (
              <div className="inspector-empty-row">연결된 흐름이 없습니다.</div>
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
            <strong>행동 캔버스</strong>
          </div>
        </InspectorSection>

        {graphMode === "state-machine" && (
          <InspectorSection title="범위 규칙" icon={<Network size={14} />}>
            <InspectorField label="전역 인터럽트">
              <div className="read-only-field">
                {interruptEdges(graph, selectedNode.scopeId).length}건
              </div>
            </InspectorField>
            <InspectorField label="종료/복귀">
              <div className="read-only-field">
                {exitReturnEdges(graph, selectedNode.scopeId).length}건
              </div>
            </InspectorField>
            <p className="inspector-help">시작 상황 · 전역 인터럽트 · 종료/복귀는 캔버스 노드가 아니라 범위 속성입니다.</p>
          </InspectorSection>
        )}

        <details className="inspector-advanced">
          <summary>고급</summary>
          <div className="inspector-advanced-body">
            <InspectorField label="고유 ID">
              <code className="id-field">{selectedNode.id}</code>
            </InspectorField>
            <InspectorField label="내부 노드 유형">
              <div className="read-only-field">{selectedNode.kind}{entityKind ? ` · ${entityKind}` : ""}</div>
            </InspectorField>
            {domain && (
              <>
                <InspectorField label="조건식 (원문)">
                  <input
                    value={domain.conditionExpression ?? ""}
                    placeholder="고급: hp < 0.5 && targetInRange"
                    onChange={(event) => updateDomain({ conditionExpression: event.target.value || undefined })}
                  />
                </InspectorField>
                <InspectorField label="지속 시간 (durationMs)">
                  <input
                    type="number"
                    min={0}
                    value={domain.timing?.durationMs ?? ""}
                    placeholder="durationMs"
                    onChange={(event) => {
                      const value = event.target.value === "" ? undefined : Number(event.target.value);
                      updateDomain({
                        timing: {
                          ...domain.timing,
                          durationMs: value === undefined || Number.isNaN(value) ? undefined : value,
                        },
                      });
                    }}
                  />
                </InspectorField>
                <div className="inspector-timing-row">
                  <InspectorField label="최소 (ms)">
                    <input
                      type="number"
                      min={0}
                      value={domain.timing?.minMs ?? ""}
                      onChange={(event) => {
                        const value = event.target.value === "" ? undefined : Number(event.target.value);
                        updateDomain({
                          timing: {
                            ...domain.timing,
                            minMs: value === undefined || Number.isNaN(value) ? undefined : value,
                          },
                        });
                      }}
                    />
                  </InspectorField>
                  <InspectorField label="최대 (ms)">
                    <input
                      type="number"
                      min={0}
                      value={domain.timing?.maxMs ?? ""}
                      onChange={(event) => {
                        const value = event.target.value === "" ? undefined : Number(event.target.value);
                        updateDomain({
                          timing: {
                            ...domain.timing,
                            maxMs: value === undefined || Number.isNaN(value) ? undefined : value,
                          },
                        });
                      }}
                    />
                  </InspectorField>
                </div>
                {entityKind === "decision" && (
                  <p className="inspector-help">
                    내부 점수·가중치는 고려 요인의 영향도에서 자동 매핑됩니다. 편집 모드에서는 수식을 노출하지 않으며, 시뮬 선택 결과는 이후 단계에서 연결합니다.
                  </p>
                )}
              </>
            )}
            <InspectorField label="중단점">
              <select value={selectedNode.breakpoint ? "on" : "off"} onChange={(event) => updateNode({ breakpoint: event.target.value === "on" })}><option value="off">사용 안 함</option><option value="on">진입 시 일시 정지</option></select>
            </InspectorField>
          </div>
        </details>

        <div className="inspector-danger-zone">
          <button onClick={onNodeDelete} disabled={["entry", "any", "exit"].includes(selectedNode.kind)}><Trash2 size={13} /> {["entry", "any", "exit"].includes(selectedNode.kind) ? "엔진 예약 노드는 삭제할 수 없음" : "요소 삭제"}</button>
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

function nodeTypeLabel(node: GraphNode): string {
  const entity = resolveDomainEntityKind(node);
  if (entity === "state") return behaviorEntityLabel("state");
  if (entity === "action") return behaviorEntityLabel("action");
  if (entity === "decision") {
    const kind = node.domain?.decisionKind ?? "SELECTOR";
    return kind === "UTILITY" ? "판단 · 고려 요인 비교" : behaviorEntityLabel("decision");
  }
  const labels: Record<GraphNode["kind"], string> = {
    state: behaviorEntityLabel("state"),
    submachine: behaviorEntityLabel("submachine"),
    entry: "시작 (숨김)",
    exit: "종료/복귀 (숨김)",
    any: "전역 인터럽트 (숨김)",
    selector: behaviorEntityLabel("decision"),
    sequence: "순서",
    condition: behaviorEntityLabel("condition"),
    task: behaviorEntityLabel("action"),
  };
  return labels[node.kind];
}

function runtimeLabel(state: RuntimeState, nodeState?: RuntimeNodeState): string {
  if (state === "stopped") return "대기";
  if (nodeState === "active" || nodeState === "running") return "실행 중";
  if (nodeState === "success") return "성공";
  if (nodeState === "failure") return "실패";
  return "미실행";
}
