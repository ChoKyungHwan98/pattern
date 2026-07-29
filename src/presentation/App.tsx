import {
  Activity,
  BarChart3,
  Bot,
  Box,
  FolderOpen,
  Layers3,
  Redo2,
  Save,
  Swords,
  Undo2,
} from "lucide-react";
import { useProjectStore } from "../application/ProjectStore";
import type { EditorViewState } from "../domain/project";
import { ActionEditor } from "./components/ActionEditor";
import { ExperimentView } from "./components/ExperimentView";
import { FsmEditor } from "./components/FsmEditor";
import { ResourceLibrary } from "./components/ResourceLibrary";

type Workspace = EditorViewState["workspace"];

const tabs: Array<{ id: Workspace; label: string; icon: typeof Box }> = [
  { id: "resources", label: "리소스", icon: Box },
  { id: "actions", label: "행동 제작", icon: Activity },
  { id: "ai", label: "AI 설계", icon: Bot },
  { id: "experiment", label: "전투 실험", icon: Swords },
  { id: "analysis", label: "분석", icon: BarChart3 },
];

export function App() {
  const store = useProjectStore();
  const workspace = store.document.editor.workspace;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Layers3 size={21} />
          </div>
          <div>
            <strong>전투 AI 제작소</strong>
            <span>{store.document.project.name}</span>
          </div>
        </div>

        <nav className="workspace-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={workspace === tab.id ? "active" : ""}
                onClick={() => store.dispatch({ type: "editor/workspace", workspace: tab.id })}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <button className="icon-button" title="프로젝트 열기 (Ctrl+O)" onClick={store.open}>
            <FolderOpen size={17} />
          </button>
          <button
            className="icon-button"
            title="실행 취소 (Ctrl+Z)"
            disabled={store.past.length === 0}
            onClick={store.undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            title="다시 실행 (Ctrl+Y)"
            disabled={store.future.length === 0}
            onClick={store.redo}
          >
            <Redo2 size={17} />
          </button>
          <button className="primary" onClick={store.save}>
            <Save size={16} />
            저장
          </button>
        </div>
      </header>

      <div className="subbar">
        <div className="document-status">
          <span className={store.dirty ? "status-dot dirty" : "status-dot"} />
          {store.dirty ? "저장되지 않은 변경" : "저장됨"}
          {store.lastSavedAt && (
            <small>
              {new Date(store.lastSavedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
        </div>
        {workspace === "ai" && (
          <div className="mode-tabs">
            <button className="active">FSM</button>
            <button disabled title="Gate 4에서 FSM의 계층 확장으로 추가됩니다.">
              HFSM <small>다음</small>
            </button>
            <button disabled title="Gate 5에서 같은 행동 라이브러리를 공유합니다.">
              행동 트리 <small>다음</small>
            </button>
          </div>
        )}
        <div className="gate-status">Gate 1 기반 · FSM 편집 진행 중</div>
      </div>

      <section className="workspace">
        {workspace === "resources" && <ResourceLibrary />}
        {workspace === "actions" && <ActionEditor />}
        {workspace === "ai" && <FsmEditor />}
        {workspace === "experiment" && (
          <ExperimentView key={store.document.project.updatedAt} />
        )}
        {workspace === "analysis" && <AnalysisPlaceholder />}
      </section>
    </div>
  );
}

function AnalysisPlaceholder() {
  return (
    <div className="analysis-placeholder">
      <BarChart3 size={34} />
      <strong>분석은 실제 실행 기록을 읽습니다.</strong>
      <p>
        상태 점유 시간, 전환 빈도, 공격 성공률, 가드·패링 성공 구간을 전투 실험의 결정론적
        입력 로그에서 계산하도록 Gate 3에 연결합니다.
      </p>
    </div>
  );
}
