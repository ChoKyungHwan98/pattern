import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleStop,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  SkipForward,
} from "lucide-react";
import { useState } from "react";
import type { EngineExportTarget } from "../adapters/engineManifest";
import type { GraphMode, RuntimeState } from "../editor/model";
import { isStudioHosted } from "../editor/screenHistory";
import type { RuntimeEngine } from "../runtime/types";

interface EditorChromeProps {
  setName: string;
  graphName: string;
  graphMode: GraphMode;
  runtimeState: RuntimeState;
  runtimeEngine: RuntimeEngine;
  tick: number;
  issueCount: number;
  /** First issue message so the badge cause is obvious. */
  issueSummary?: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onRuntimeStateChange: (state: RuntimeState) => void;
  onStep: () => void;
  onValidationOpen: () => void;
  onExport: (target: "ir" | "diagnostics" | EngineExportTarget) => void;
  onBackToLibrary: () => void;
}

export function EditorChrome({
  setName,
  graphName,
  runtimeState,
  tick,
  issueCount,
  issueSummary,
  sidebarOpen,
  onSidebarToggle,
  onRuntimeStateChange,
  onStep,
  onValidationOpen,
  onExport,
  onBackToLibrary,
}: EditorChromeProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const studioHosted = isStudioHosted();
  return (
    <header className="workbench-header">
      {!studioHosted && (
        <button className="back-to-library" type="button" onClick={onBackToLibrary} title="패턴 세트 목록으로">
          <ArrowLeft size={16} /><span>세트 목록</span>
        </button>
      )}

      <button
        className="header-icon-button"
        type="button"
        aria-label={sidebarOpen ? "패턴 목록 접기" : "패턴 목록 열기"}
        title={sidebarOpen ? "패턴 목록 접기" : "패턴 목록 열기"}
        onClick={onSidebarToggle}
      >
        {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
      </button>

      <div className="header-document">
        <strong>{graphName}</strong>
        <span>{setName} · 행동 캔버스</span>
      </div>

      <div className="header-spacer" />

      <button
        className={`validation-summary ${issueCount ? "has-issues" : "is-valid"}`}
        type="button"
        onClick={onValidationOpen}
        title={issueCount ? (issueSummary || `${issueCount}개 문제`) : "검증 통과"}
      >
        {issueCount ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
        <span>
          {issueCount
            ? (issueCount === 1 && issueSummary
              ? issueSummary
              : `${issueCount}개 문제${issueSummary ? ` · ${issueSummary}` : ""}`)
            : "검증 통과"}
        </span>
      </button>

      <div className="runtime-engine" title="내부 실행 어댑터 (제품 표기 아님)">
        <span />
        시뮬레이터
      </div>

      <div className="header-export-menu">
        <button className="header-export-button" type="button" onClick={() => setExportOpen((current) => !current)} title="패턴 내보내기" aria-expanded={exportOpen}>
          <Download size={14} />
          <span>내보내기</span>
          <ChevronDown size={11} />
        </button>
        {exportOpen && (
          <div className="header-export-popover">
            <button type="button" onClick={() => { onExport("ir"); setExportOpen(false); }}><strong>Pattern IR</strong><span>엔진 중립 원본</span></button>
            <button type="button" onClick={() => { onExport("diagnostics"); setExportOpen(false); }}><strong>진단 보고서</strong><span>오류·참조·엔진 준비 상태</span></button>
            <button type="button" onClick={() => { onExport("unity"); setExportOpen(false); }}><strong>Unity UPM 패키지</strong><span>Importer + Runtime + Tests ZIP</span></button>
            <button type="button" onClick={() => { onExport("unreal"); setExportOpen(false); }}><strong>Unreal 플러그인</strong><span>Runtime + Editor + Tests ZIP</span></button>
          </div>
        )}
      </div>

      <div className="runtime-controls" aria-label="시뮬레이션 제어">
        <button
          type="button"
          className={runtimeState === "playing" ? "active" : ""}
          aria-label={runtimeState === "playing" ? "일시 정지" : "실행"}
          title={runtimeState === "playing" ? "일시 정지 (Ctrl+Shift+P)" : "실행 (Ctrl+P)"}
          onClick={() =>
            onRuntimeStateChange(runtimeState === "playing" ? "paused" : "playing")
          }
        >
          {runtimeState === "playing" ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" aria-label="한 단계 실행" title="한 단계 실행 (Ctrl+Alt+P)" onClick={onStep}>
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          aria-label="실행 중지"
          title="실행 중지 (Ctrl+P)"
          onClick={() => onRuntimeStateChange("stopped")}
        >
          <CircleStop size={16} />
        </button>
        <span className={`runtime-readout ${runtimeState}`}>
          {runtimeState === "stopped" ? "편집" : `${tick} 틱`}
        </span>
      </div>
    </header>
  );
}


