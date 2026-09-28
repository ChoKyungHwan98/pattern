import { useMemo, useState } from "react";
import { Crosshair, ListChecks } from "lucide-react";
import type { BlackboardEntry, GraphNode } from "../editor/model";
import {
  evaluateDecision,
  formatScore,
  type CandidateTrace,
  type DecisionTraceResult,
} from "../editor/utilitySimulation";
import { formatConsiderationBrief, formatHardRequirementBrief, formatRangeDisplay, resolveConsiderationRange } from "../editor/domain";

interface DecisionTracePanelProps {
  decisionNode?: GraphNode;
  blackboard: BlackboardEntry[];
  nameLookup: Record<string, string>;
  /** When false, panel explains that Simulation is inactive. */
  simulationActive: boolean;
}

function candidateStatusBadge(candidate: CandidateTrace): { label: string; kind: "selected" | "excluded" | "eligible" | "zero" } {
  if (candidate.excluded) {
    return { label: "제외 · 점수 없음", kind: "excluded" };
  }
  if (candidate.selected) {
    return { label: `선택 · ${formatScore(candidate.finalScore)}`, kind: "selected" };
  }
  if (candidate.finalScore === 0) {
    return { label: "0.00 · 자격 있음 · 미선택", kind: "zero" };
  }
  return { label: `${formatScore(candidate.finalScore)} · 미선택`, kind: "eligible" };
}

export function DecisionTracePanel({
  decisionNode,
  blackboard,
  nameLookup,
  simulationActive,
}: DecisionTracePanelProps) {
  const trace = useMemo<DecisionTraceResult | undefined>(() => {
    if (!decisionNode || !simulationActive) return undefined;
    return evaluateDecision(decisionNode, blackboard, (id) => nameLookup[id] ?? id);
  }, [decisionNode, blackboard, nameLookup, simulationActive]);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>();

  const selected: CandidateTrace | undefined = useMemo(() => {
    if (!trace) return undefined;
    const id = selectedCandidateId ?? trace.selectedCandidateId ?? trace.candidates[0]?.candidate.id;
    return trace.candidates.find((item) => item.candidate.id === id) ?? trace.candidates[0];
  }, [trace, selectedCandidateId]);

  if (!decisionNode) {
    return (
      <div className="decision-trace-empty">
        <ListChecks size={18} />
        <div>
          <strong>판단 노드를 선택하세요</strong>
          <p>캔버스에서 판단을 고르면 후보 점수와 선택·제외 이유가 표시됩니다.</p>
        </div>
      </div>
    );
  }

  if (!simulationActive) {
    return (
      <div className="decision-trace-empty">
        <Crosshair size={18} />
        <div>
          <strong>시뮬레이션 비활성</strong>
          <p>
            편집 모드에서는 실시간 점수를 표시하지 않습니다. 상단에서 실행(시뮬)을 시작하거나
            이 탭을 연 뒤 문맥 테스트 값을 조정하세요.
          </p>
        </div>
      </div>
    );
  }

  if (!trace || trace.candidates.length === 0) {
    return (
      <div className="decision-trace-empty">
        <ListChecks size={18} />
        <div>
          <strong>{decisionNode.name}</strong>
          <p>후보 행동이 없습니다. Inspector에서 후보를 추가하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="decision-trace-panel" data-testid="decision-trace-panel">
      <header className="decision-trace-header">
        <div>
          <strong>{trace.decisionName}</strong>
          <span>판단 시뮬 · 점수·제외·선택 이유</span>
        </div>
        <div className="decision-trace-pick">
          {trace.selectedActionName
            ? <>선택: <em>{trace.selectedActionName}</em> ({formatScore(trace.candidates.find((c) => c.selected)?.finalScore)})</>
            : "선택 가능한 후보 없음 (하드 조건 전부 미충족)"}
        </div>
      </header>

      <p className="decision-trace-hint">
        모든 후보를 클릭해 이유를 볼 수 있습니다.
        <strong> 제외</strong>는 하드 조건 실패로 점수가 없고,
        <strong> 0.00</strong>은 자격은 있으나 점수가 낮은 미선택입니다.
      </p>

      <div className="decision-trace-layout">
        <section className="decision-trace-scores" aria-label="후보 점수 비교">
          <h4>후보 점수</h4>
          <ul>
            {trace.candidates.map((candidate) => {
              const badge = candidateStatusBadge(candidate);
              return (
                <li key={candidate.candidate.id}>
                  <button
                    type="button"
                    className={[
                      "decision-trace-score-row",
                      `status-${badge.kind}`,
                      candidate.selected ? "is-selected" : "",
                      candidate.excluded ? "is-excluded" : "",
                      selected?.candidate.id === candidate.candidate.id ? "is-active" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelectedCandidateId(candidate.candidate.id)}
                    title={candidate.statusReason}
                  >
                    <span className="name">{candidate.actionName}</span>
                    <span className={`meta status-${badge.kind}`}>{badge.label}</span>
                    {!candidate.excluded && candidate.finalScore !== null && (
                      <span className="bar" style={{ width: `${Math.round(candidate.finalScore * 100)}%` }} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {selected && (
          <section className="decision-trace-detail" aria-label="선택 후보 판단 이유" data-testid="decision-trace-detail">
            <h4>{selected.actionName} · 선택 이유</h4>
            <p className={`decision-trace-why status-${candidateStatusBadge(selected).kind}`} data-testid="decision-trace-why">
              {selected.statusReason}
            </p>
            <div className="decision-trace-block">
              <strong>1) 하드 조건</strong>
              {selected.hardResults.length === 0 && <p className="inspector-help">하드 조건 없음 → 통과</p>}
              <ul className="decision-trace-hard">
                {selected.hardResults.map((item) => (
                  <li key={item.requirement.id} className={item.passed ? "pass" : "fail"}>
                    <span>{item.passed ? "통과" : "실패"}</span>
                    <code>{item.brief}</code>
                    <em>현재 {item.actualRaw}</em>
                  </li>
                ))}
              </ul>
              {selected.excluded && (
                <p className="decision-trace-excluded">
                  하드 조건 미충족 → 후보 제외 · 점수 계산 안 함 (0.00과 다름)
                </p>
              )}
            </div>

            {!selected.excluded && (
              <>
                <div className="decision-trace-block">
                  <strong>2–4) 고려 요인 → 정규화 → 부분 점수</strong>
                  <table className="decision-trace-table">
                    <thead>
                      <tr>
                        <th>문맥 값</th>
                        <th>입력</th>
                        <th>방향</th>
                        <th>범위</th>
                        <th>정규화</th>
                        <th>가중</th>
                        <th>부분</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.considerations.map((item) => (
                        <tr key={item.consideration.id}>
                          <td>{item.briefVariable}</td>
                          <td>{item.inputRaw}</td>
                          <td>{item.directionLabel}</td>
                          <td>{formatRangeDisplay(resolveConsiderationRange(item.consideration)) || "—"}</td>
                          <td>{formatScore(item.normalized)}</td>
                          <td>{formatScore(item.weight)}</td>
                          <td>{formatScore(item.partialScore)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selected.considerations.length === 0 && (
                    <p className="inspector-help">고려 요인 없음 → 점수 0.00 (자격은 있음)</p>
                  )}
                </div>
                <div className="decision-trace-block final">
                  <strong>5) 최종 점수</strong>
                  <em>{formatScore(selected.finalScore)}</em>
                  {selected.selected && <span className="badge">최대 점수 · 선택됨</span>}
                  {!selected.selected && (
                    <span className="badge muted">미선택 · {selected.finalScore === 0 ? "0.00이지만 제외는 아님" : "더 높은 후보 있음"}</span>
                  )}
                </div>
              </>
            )}

            <div className="decision-trace-block muted">
              <strong>기준 요약</strong>
              <p>
                {[
                  ...selected.candidate.hardRequirements.map(formatHardRequirementBrief),
                  ...selected.candidate.considerations.map(formatConsiderationBrief),
                ].join(" · ") || "기준 없음"}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
