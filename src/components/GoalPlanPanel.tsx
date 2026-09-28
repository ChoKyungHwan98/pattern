import { useMemo, useState } from "react";
import {
  Flag,
  ListOrdered,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Wand2,
} from "lucide-react";
import type { BlackboardEntry } from "../editor/model";
import { contextKeyDisplayName } from "../editor/contextLabels";
import {
  createHardRequirement,
  HARD_REQUIREMENT_OPERATOR_LABELS,
  type HardRequirementOperator,
} from "../editor/domain";
import {
  advanceExecution,
  createApproachAttackRangeExample,
  createEmptyAction,
  createEmptyGoal,
  formatConditionsList,
  formatWorldState,
  generatePlan,
  invalidateCurrentPreconditions,
  PLAN_OUTCOME_LABELS,
  syncActionFromConditions,
  syncGoalFromConditions,
  type GoapAction,
  type GoapGoal,
  type PlanOutcome,
  type PlanResult,
  type WorldCondition,
  type WorldState,
} from "../editor/goapPlanner";

export interface GoalPlanPanelProps {
  /** Context vars from 문맥 — Condition Builder suggestions (not raw expression). */
  blackboard?: BlackboardEntry[];
  /**
   * simulation: compact result for bottom Simulation tab (canvas stays hero).
   * authoring: writer mode; detailed forms sit under 고급 so it never looks like a GOAP editor.
   */
  variant?: "simulation" | "authoring";
}

/**
 * Goal / Plan area — designer language only (현재 상황·문맥 / 원하는 결과 / 실행 계획).
 * Internals remain planner-compatible; UI must not look like a GOAP editor.
 * Does NOT reuse Utility score UI. Does NOT auto-wire Utility → planner.
 */
export function GoalPlanPanel({ blackboard = [], variant = "simulation" }: GoalPlanPanelProps) {
  const example = useMemo(() => createApproachAttackRangeExample(), []);
  const [goal, setGoal] = useState<GoapGoal>(example.goal);
  const [world, setWorld] = useState<WorldState>(example.world);
  const [actions, setActions] = useState<GoapAction[]>(example.actions);
  const [plan, setPlan] = useState<PlanResult>(() =>
    generatePlan(example.goal, example.world, example.actions),
  );
  const [authoringMode, setAuthoringMode] = useState<"goal" | "actions">("goal");

  const contextKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of blackboard) {
      if (entry.key.trim()) keys.add(entry.key.trim());
    }
    for (const key of Object.keys(world)) keys.add(key);
    for (const condition of goal.desiredConditions) {
      if (condition.variableKey.trim()) keys.add(condition.variableKey.trim());
    }
    for (const action of actions) {
      for (const condition of [
        ...action.preconditionConditions,
        ...action.effectConditions,
      ]) {
        if (condition.variableKey.trim()) keys.add(condition.variableKey.trim());
      }
    }
    return [...keys].sort();
  }, [actions, blackboard, goal.desiredConditions, world]);

  const rebuild = (
    nextGoal: GoapGoal,
    nextWorld: WorldState,
    nextActions: GoapAction[],
    reason: string | null = null,
  ) => {
    const syncedGoal = syncGoalFromConditions(nextGoal);
    const syncedActions = nextActions.map(syncActionFromConditions);
    setGoal(syncedGoal);
    setWorld(nextWorld);
    setActions(syncedActions);
    setPlan(
      generatePlan(syncedGoal, nextWorld, syncedActions, { replanReason: reason }),
    );
  };

  const applyWorld = (nextWorld: WorldState, reason: string | null) => {
    rebuild(goal, nextWorld, actions, reason);
  };

  const loadExampleScenario = (
    kind: "fail" | "three-step" | "achieved" | "invalidate",
  ) => {
    const base = createApproachAttackRangeExample();
    if (kind === "fail") {
      const nextWorld = { ...base.world, HasTarget: false };
      rebuild(base.goal, nextWorld, base.actions, `데모: ${contextKeyDisplayName("HasTarget")}=false`);
      return;
    }
    if (kind === "three-step") {
      rebuild(base.goal, base.world, base.actions, `데모: ${contextKeyDisplayName("HasTarget")}=true · 3단계 계획`);
      return;
    }
    if (kind === "achieved") {
      const nextWorld = { ...base.world, InAttackRange: true };
      rebuild(base.goal, nextWorld, base.actions, `데모: ${contextKeyDisplayName("InAttackRange")}=true`);
      return;
    }
    // invalidate: build plan then invalidate mid-exec
    const built = generatePlan(base.goal, base.world, base.actions);
    const brokenWorld = { ...built.plan[0]!.stateBefore, HasTarget: false };
    const invalidated = invalidateCurrentPreconditions(built, brokenWorld);
    setGoal(syncGoalFromConditions(base.goal));
    setWorld(brokenWorld);
    setActions(base.actions.map(syncActionFromConditions));
    setPlan(invalidated);
  };

  const currentStep =
    plan.executionIndex >= 0 && plan.executionIndex < plan.plan.length
      ? plan.plan[plan.executionIndex]
      : undefined;
  const executionLabel =
    plan.outcome === "unreachable" || plan.outcome === "precondition_invalidated"
      ? "실행 불가"
      : plan.outcome === "already_achieved"
        ? "불필요 (이미 달성)"
        : plan.executionIndex < 0
          ? "시작 전"
          : plan.executionIndex >= plan.plan.length
            ? "완료"
            : `${plan.executionIndex + 1} / ${plan.plan.length} · ${currentStep?.actionName ?? ""}`;

  const desiredState = syncGoalFromConditions(goal).desired ?? {};

  return (
    <div className={`goal-plan-panel variant-${variant}`} data-testid="goal-plan-panel" data-variant={variant}>
      <header className="goal-plan-header">
        <div>
          <strong>목표 · 실행 계획</strong>
          <span>원하는 결과와 지금 문맥을 보고 실행 계획을 확인합니다</span>
        </div>
        <div className="goal-plan-actions">
          <button
            type="button"
            onClick={() =>
              rebuild(example.goal, example.world, example.actions, "예제 초기 상황으로 재계획")
            }
            title="예제 초기화 후 재계획"
          >
            <RotateCcw size={14} /> 재계획
          </button>
          <button
            type="button"
            disabled={plan.outcome !== "plan_success" || plan.executionIndex >= plan.plan.length}
            onClick={() => setPlan((current) => advanceExecution(current))}
            title="다음 실행 단계"
          >
            <Play size={14} /> 한 단계 실행
          </button>
          <button
            type="button"
            disabled={plan.plan.length === 0}
            onClick={() => {
              const idx =
                plan.executionIndex >= 0 && plan.executionIndex < plan.plan.length
                  ? plan.executionIndex
                  : 0;
              const step = plan.plan[idx];
              if (!step) return;
              const broken = { ...step.stateBefore };
              const firstKey = Object.keys(step.preconditions)[0];
              if (firstKey) {
                const expected = step.preconditions[firstKey];
                broken[firstKey] =
                  typeof expected === "boolean" ? !expected : expected === 0 ? 1 : 0;
              }
              setWorld(broken);
              setPlan(invalidateCurrentPreconditions(plan, broken));
            }}
            title="현재 단계 실행 조건을 깨뜨려 무효화·재계획 필요 표시"
          >
            <ShieldAlert size={14} /> 조건 무효화
          </button>
        </div>
      </header>

      <div className="goal-plan-demo-row" data-testid="goal-plan-demos">
        <span>데모</span>
        <button type="button" onClick={() => loadExampleScenario("fail")}>
          대상 없음 → 실패
        </button>
        <button type="button" onClick={() => loadExampleScenario("three-step")}>
          대상 있음 → 3단계
        </button>
        <button type="button" onClick={() => loadExampleScenario("achieved")}>
          이미 범위 안 → 달성
        </button>
        <button type="button" onClick={() => loadExampleScenario("invalidate")}>
          실행 중 무효화 → 재계획
        </button>
      </div>

      <div className={`goal-plan-columns${variant === "simulation" ? " is-simulation" : ""}`}>
        {/* ───── Authoring (고급) — never crush canvas height ───── */}
        <details className="goal-plan-advanced" data-testid="goal-plan-advanced" {...(variant === "authoring" ? { open: true } : {})}>
          <summary>고급 · 목표·행동 작성</summary>
          <section className="goal-plan-authoring" aria-label="작성" data-testid="goal-plan-authoring">
          <header className="goal-plan-section-title">
            <Wand2 size={14} />
            <strong>작성</strong>
            <span>목표 · 사용할 행동</span>
            <div className="goal-plan-seg">
              <button
                type="button"
                className={authoringMode === "goal" ? "is-active" : ""}
                onClick={() => setAuthoringMode("goal")}
              >
                목표
              </button>
              <button
                type="button"
                className={authoringMode === "actions" ? "is-active" : ""}
                onClick={() => setAuthoringMode("actions")}
              >
                사용할 행동
              </button>
            </div>
          </header>

          {authoringMode === "goal" && (
            <div className="goal-plan-card authoring-card">
              <h4><Flag size={14} /> 목표 작성</h4>
              <label className="goal-plan-field">
                <span>이름</span>
                <input
                  aria-label="목표 이름"
                  value={goal.name}
                  onChange={(event) => {
                    const next = { ...goal, name: event.target.value };
                    setGoal(next);
                  }}
                  onBlur={() => rebuild(goal, world, actions, "목표 이름 변경")}
                />
              </label>
              <label className="goal-plan-field">
                <span>의도 / 설명</span>
                <textarea
                  aria-label="목표 의도"
                  rows={2}
                  value={goal.intent}
                  onChange={(event) => setGoal({ ...goal, intent: event.target.value })}
                  onBlur={() => rebuild(goal, world, actions, null)}
                  placeholder="이 목표가 달성하려는 의도"
                />
              </label>
              <ConditionBuilder
                title="원하는 결과"
                help="문맥 키를 고르세요. 원시 표현식 입력이 기본이 아닙니다."
                conditions={goal.desiredConditions}
                contextKeys={contextKeys}
                listId="goal-desired-vars"
                onChange={(desiredConditions) => {
                  const next = syncGoalFromConditions({ ...goal, desiredConditions });
                  rebuild(next, world, actions, "목표 조건 변경");
                }}
              />
              <button
                type="button"
                className="goal-plan-secondary"
                onClick={() => {
                  const next = createEmptyGoal();
                  rebuild(next, world, actions, "새 목표");
                }}
              >
                <Plus size={13} /> 빈 목표로 초기화
              </button>
            </div>
          )}

          {authoringMode === "actions" && (
            <div className="goal-plan-card authoring-card">
              <div className="goal-plan-card-head">
                <h4><ListOrdered size={14} /> 사용할 행동 작성</h4>
                <button
                  type="button"
                  className="inspector-add-button compact"
                  onClick={() => {
                    const next = [...actions, createEmptyAction()];
                    rebuild(goal, world, next, "행동 추가");
                  }}
                >
                  <Plus size={12} /> 추가
                </button>
              </div>
              <ul className="goal-plan-action-editor">
                {actions.map((action, actionIndex) => (
                  <li key={action.id}>
                    <div className="goal-plan-action-editor-head">
                      <input
                        aria-label={`행동 이름 ${actionIndex + 1}`}
                        value={action.name}
                        onChange={(event) => {
                          const next = actions.map((item, index) =>
                            index === actionIndex ? { ...item, name: event.target.value } : item,
                          );
                          setActions(next);
                        }}
                        onBlur={() => rebuild(goal, world, actions, "행동 이름 변경")}
                      />
                      <label className="goal-plan-cost">
                        <span title="필요할 때만">비용</span>
                        <input
                          aria-label={`비용 ${actionIndex + 1}`}
                          type="number"
                          min={0}
                          value={action.cost}
                          onChange={(event) => {
                            const cost = Math.max(0, Number(event.target.value) || 0);
                            const next = actions.map((item, index) =>
                              index === actionIndex ? { ...item, cost } : item,
                            );
                            rebuild(goal, world, next, "행동 비용 변경");
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`${action.name} 삭제`}
                        onClick={() => {
                          const next = actions.filter((_, index) => index !== actionIndex);
                          rebuild(goal, world, next, "행동 삭제");
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <ConditionBuilder
                      title="사용할 수 있을 때"
                      conditions={action.preconditionConditions}
                      contextKeys={contextKeys}
                      listId={`action-pre-${action.id}`}
                      onChange={(preconditionConditions) => {
                        const next = actions.map((item, index) =>
                          index === actionIndex
                            ? syncActionFromConditions({ ...item, preconditionConditions })
                            : item,
                        );
                        rebuild(goal, world, next, `실행 조건 변경: ${action.name}`);
                      }}
                    />
                    <ConditionBuilder
                      title="행동 후"
                      conditions={action.effectConditions}
                      contextKeys={contextKeys}
                      listId={`action-eff-${action.id}`}
                      effectMode
                      onChange={(effectConditions) => {
                        const next = actions.map((item, index) =>
                          index === actionIndex
                            ? syncActionFromConditions({ ...item, effectConditions })
                            : item,
                        );
                        rebuild(goal, world, next, `실행 결과 변경: ${action.name}`);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          </section>
        </details>

        {/* ───── Result ───── */}
        <section className="goal-plan-result" aria-label="결과" data-testid="goal-plan-result">
          <header className="goal-plan-section-title">
            <ListOrdered size={14} />
            <strong>결과</strong>
            <span>현재 상황/문맥 → 실행 계획 → 원하는 결과</span>
          </header>

          <div className="goal-plan-grid result-grid">
            <article className="goal-plan-card" aria-label="현재 상황/문맥">
              <h4>현재 상황/문맥</h4>
              <dl className="goal-plan-facts editable">
                {Object.entries(world).map(([key, value]) => (
                  <div key={key}>
                    <dt title={key}>{contextKeyDisplayName(key)}</dt>
                    <dd>
                      {typeof value === "boolean" ? (
                        <button
                          type="button"
                          className={value ? "is-true" : "is-false"}
                          onClick={() =>
                            applyWorld(
                              { ...world, [key]: !value },
                              `현재 상황 변경: ${contextKeyDisplayName(key)}=${!value}`,
                            )
                          }
                        >
                          {String(value)}
                        </button>
                      ) : (
                        String(value)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="inspector-help">값을 바꾸면 자동으로 재계획합니다.</p>
            </article>

            <article className="goal-plan-card" aria-label="원하는 결과">
              <h4>원하는 결과</h4>
              <p className="goal-plan-title">{goal.name}</p>
              {goal.intent && <p className="inspector-help">{goal.intent}</p>}
              <dl className="goal-plan-facts">
                {Object.entries(desiredState).map(([key, value]) => {
                  const met = world[key] === value || plan.finalWorld[key] === value;
                  return (
                    <div key={key}>
                      <dt title={key}>{contextKeyDisplayName(key)}</dt>
                      <dd className={met ? "is-met" : "is-unmet"}>{String(value)}</dd>
                    </div>
                  );
                })}
              </dl>
            </article>

            <article className="goal-plan-card wide" aria-label="실행 계획">
              <h4>실행 계획</h4>
              <OutcomeBadge outcome={plan.outcome} reason={plan.outcomeReason} />
              {plan.outcome === "unreachable" && (
                <p className="goal-plan-fail" data-testid="plan-fail-reason">
                  계획 생성 실패
                  {plan.unmetConditions.length > 0 && (
                    <> · 충족되지 않은 조건: {plan.unmetConditions.join(", ")}</>
                  )}
                  {plan.failReason && plan.unmetConditions.length === 0 && (
                    <>: {plan.failReason}</>
                  )}
                </p>
              )}
              {plan.outcome === "already_achieved" && (
                <p className="goal-plan-ok" data-testid="plan-already-achieved">
                  이미 목표 달성 — 빈 계획
                </p>
              )}
              {plan.outcome === "precondition_invalidated" && (
                <p className="goal-plan-fail" data-testid="plan-invalidated">
                  실행 중 조건 무효화: {plan.outcomeReason}
                </p>
              )}
              {plan.plan.length > 0 && plan.outcome === "plan_success" && (
                <ol className="goal-plan-steps" data-testid="plan-steps">
                  {plan.plan.map((step, index) => (
                    <li
                      key={`${step.actionId}-${index}`}
                      className={[
                        index === plan.executionIndex ? "is-current" : "",
                        index < plan.executionIndex ? "is-done" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <strong>{step.actionName}</strong>
                      <span>비용 {step.cost}</span>
                      <small>
                        사용할 수 있을 때: {formatWorldState(step.preconditions)}
                        {" → "}
                        행동 후: {formatWorldState(step.effects)}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
              <div className="goal-plan-meta">
                <span>
                  총 비용: <em>{plan.totalCost}</em>
                </span>
                <span>
                  현재 실행 단계:{" "}
                  <em data-testid="plan-execution-step">{executionLabel}</em>
                </span>
                {plan.replanReason && (
                  <span className="replan" data-testid="plan-replan-reason">
                    재계획 필요: {plan.replanReason}
                  </span>
                )}
              </div>
            </article>

            <article className="goal-plan-card" aria-label="행동 요약">
              <h4>행동 요약</h4>
              <ul className="goal-plan-action-list">
                {actions.map((action) => (
                  <li key={action.id}>
                    <strong>{action.name}</strong>
                    <span>비용 {action.cost}</span>
                    <small>
                      조건 {formatConditionsList(action.preconditionConditions)}
                    </small>
                    <small>
                      결과 {formatConditionsList(action.effectConditions)}
                    </small>
                  </li>
                ))}
              </ul>
            </article>

            <article className="goal-plan-card wide" aria-label="계획 추적">
              <h4>계획 추적 <small>(고급)</small></h4>
              <p className="inspector-help">
                결과 구분: {Object.values(PLAN_OUTCOME_LABELS).join(" · ")}
              </p>
              <ul className="goal-plan-trace" data-testid="plan-trace-list">
                {plan.trace.map((entry, index) => (
                  <li
                    key={`${entry.step}-${entry.kind}-${index}`}
                    className={`kind-${entry.kind}${entry.outcome ? ` outcome-${entry.outcome}` : ""}`}
                  >
                    <span className="kind">
                      {entry.outcome
                        ? PLAN_OUTCOME_LABELS[entry.outcome]
                        : entry.kind}
                    </span>
                    <span>{entry.message}</span>
                    {entry.state && <code>{formatWorldState(entry.state)}</code>}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

function OutcomeBadge({
  outcome,
  reason,
}: {
  outcome: PlanOutcome;
  reason: string;
}) {
  return (
    <div
      className={`goal-plan-outcome outcome-${outcome}`}
      data-testid="plan-outcome"
      data-outcome={outcome}
      title={reason}
    >
      <strong>{PLAN_OUTCOME_LABELS[outcome]}</strong>
      <span>{reason}</span>
    </div>
  );
}

/** Condition Builder — Context vars + operators (reuse Decision hard-requirement UX). */
function ConditionBuilder({
  title,
  help,
  conditions,
  contextKeys,
  listId,
  onChange,
  effectMode = false,
}: {
  title: string;
  help?: string;
  conditions: WorldCondition[];
  contextKeys: string[];
  listId: string;
  onChange: (conditions: WorldCondition[]) => void;
  effectMode?: boolean;
}) {
  const operators = (
    Object.keys(HARD_REQUIREMENT_OPERATOR_LABELS) as HardRequirementOperator[]
  ).filter((op) =>
    effectMode ? op === "is_true" || op === "is_false" || op === "eq" : true,
  );

  return (
    <div className="decision-subblock goal-condition-builder">
      <div className="decision-subblock-title">
        <span>{title}</span>
        <button
          type="button"
          className="inspector-add-button compact"
          onClick={() =>
            onChange([
              ...conditions,
              createHardRequirement({
                variableKey: contextKeys[0] ?? "",
                operator: "is_true",
              }),
            ])
          }
        >
          <Plus size={12} /> 추가
        </button>
      </div>
      {help && <p className="inspector-help">{help}</p>}
      {conditions.length === 0 && (
        <p className="inspector-help">
          {effectMode
            ? "예: 공격 범위 안 참"
            : "예: 대상 발견됨 참 · 문맥 값에서 키 선택"}
        </p>
      )}
      <datalist id={listId}>
        {contextKeys.map((key) => (
          <option value={key} key={key} />
        ))}
      </datalist>
      {conditions.map((condition, index) => (
        <div className="hard-requirement-row" key={condition.id}>
          <input
            aria-label={`${title} 문맥 값 ${index + 1}`}
            placeholder="문맥 값"
            value={condition.variableKey}
            list={listId}
            onChange={(event) => {
              const next = conditions.map((item, itemIndex) =>
                itemIndex === index
                  ? { ...item, variableKey: event.target.value }
                  : item,
              );
              onChange(next);
            }}
          />
          <select
            aria-label={`${title} 연산 ${index + 1}`}
            value={condition.operator}
            onChange={(event) => {
              const operator = event.target.value as HardRequirementOperator;
              const next = conditions.map((item, itemIndex) =>
                itemIndex === index ? { ...item, operator } : item,
              );
              onChange(next);
            }}
          >
            {operators.map((op) => (
              <option value={op} key={op}>
                {HARD_REQUIREMENT_OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
          {condition.operator !== "is_true" && condition.operator !== "is_false" ? (
            <input
              aria-label={`${title} 값 ${index + 1}`}
              placeholder="값"
              value={condition.value ?? ""}
              onChange={(event) => {
                const next = conditions.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, value: event.target.value } : item,
                );
                onChange(next);
              }}
            />
          ) : (
            <span className="hard-requirement-spacer" />
          )}
          <button
            type="button"
            aria-label={`${title} 삭제 ${index + 1}`}
            onClick={() => onChange(conditions.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
