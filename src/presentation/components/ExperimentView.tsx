import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectStore } from "../../application/ProjectStore";
import type { FsmGraph, SensorKey } from "../../domain/project";
import { FsmRuntime, type RuntimeSnapshot } from "../../runtime/FsmRuntime";

export function ExperimentView() {
  const { document } = useProjectStore();
  const graph = document.behaviorGraphs.find(
    (candidate): candidate is FsmGraph => candidate.kind === "fsm",
  );
  const [runtime, setRuntime] = useState<FsmRuntime | null>(() =>
    graph ? new FsmRuntime(document, graph) : null,
  );
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(
    runtime?.getSnapshot() ?? null,
  );
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = runtime?.step();
      if (next) setSnapshot(next);
    }, 1000 / 60);
    return () => window.clearInterval(timer);
  }, [playing, runtime]);

  if (!graph || !snapshot || !runtime) {
    return <div className="empty-state">실행할 FSM이 없습니다.</div>;
  }

  const activeState = graph.states.find((state) => state.id === snapshot.activeStateId);
  const setSensor = (key: SensorKey, value: boolean | number | string) => {
    runtime.setSensor(key, value);
    setSnapshot(runtime.getSnapshot());
  };
  const reset = () => {
    const next = new FsmRuntime(document, graph);
    setRuntime(next);
    setSnapshot(next.getSnapshot());
    setPlaying(false);
  };

  return (
    <div className="experiment-layout">
      <aside className="library-panel">
        <div className="panel-heading">
          <div>
            <small>현재 AI 상태</small>
            <strong>{activeState?.name ?? "없음"}</strong>
          </div>
          <span className="live-pill">실행 중</span>
        </div>
        <div className="sensor-controls">
          <label>
            대상 거리 <strong>{Number(snapshot.sensors["target.distance"]).toFixed(1)}m</strong>
            <input
              type="range"
              min={0}
              max={12}
              step={0.1}
              value={Number(snapshot.sensors["target.distance"])}
              onChange={(event) => setSensor("target.distance", Number(event.target.value))}
            />
          </label>
          <label className="check-control">
            <input
              type="checkbox"
              checked={Boolean(snapshot.sensors["target.visible"])}
              onChange={(event) => setSensor("target.visible", event.target.checked)}
            />
            대상이 보임
          </label>
          <label>
            플레이어 행동
            <select
              value={String(snapshot.sensors["target.action"])}
              onChange={(event) => setSensor("target.action", event.target.value)}
            >
              <option>대기</option>
              <option>검 공격</option>
              <option>화염구</option>
              <option>가드</option>
            </select>
          </label>
        </div>
      </aside>

      <main className="experiment-stage">
        <div className="preview-grid" />
        {document.assets.some((asset) => asset.kind === "character") ? (
          <div className="simulation-message">
            <strong>문서 기반 60Hz AI가 실행 중입니다.</strong>
            <p>다음 Gate에서 선택한 인간형 리그에 행동·검 궤적·투사체를 결합합니다.</p>
          </div>
        ) : (
          <div className="import-callout">
            <strong>캐릭터 없이 가짜 인형을 표시하지 않습니다.</strong>
            <p>
              현재 FSM 판단은 실제 문서로 실행 중입니다. 3D 전투 확인에는 리소스 화면에서
              인간형 캐릭터를 연결하세요.
            </p>
          </div>
        )}
        <div className="runtime-hud">
          <small>현재 프레임</small>
          <strong>{snapshot.tick}</strong>
          <small>현재 상태</small>
          <strong>{activeState?.name ?? "없음"}</strong>
        </div>
        <div className="playback-bar">
          <button onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
            {playing ? "일시정지" : "재생"}
          </button>
          <button
            onClick={() => {
              const next = runtime.step();
              if (next) setSnapshot(next);
            }}
          >
            <StepForward size={17} /> 1프레임
          </button>
          <button onClick={reset}>
            <RotateCcw size={17} /> 초기화
          </button>
        </div>
      </main>

      <aside className="property-panel trace-panel">
        <div className="panel-heading">
          <div>
            <small>판단 근거</small>
            <strong>실행 기록</strong>
          </div>
        </div>
        {[...snapshot.traces].reverse().map((trace) => {
          const state = graph.states.find((candidate) => candidate.id === trace.stateId);
          return (
            <div className="trace-entry" key={`${trace.tick}:${trace.stateId}`}>
              <span>{trace.tick}f</span>
              <div>
                <strong>{state?.name ?? "알 수 없는 상태"}</strong>
                <p>{trace.reason}</p>
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
