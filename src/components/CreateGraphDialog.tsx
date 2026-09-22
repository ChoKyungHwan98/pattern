import { Network, TreePine, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { GraphMode } from "../editor/model";

interface CreateGraphDialogProps {
  onClose: () => void;
  onCreate: (mode: GraphMode, name: string) => void;
}

export function CreateGraphDialog({ onClose, onCreate }: CreateGraphDialogProps) {
  const [mode, setMode] = useState<GraphMode>("state-machine");
  const [name, setName] = useState("");
  const submit = () => onCreate(mode, name.trim() || defaultName(mode));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="pattern-modal graph-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-graph-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>그래프 문서</span><strong id="new-graph-title">새 그래프 만들기</strong></div>
          <button aria-label="닫기" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="graph-type-options" role="radiogroup" aria-label="그래프 종류">
          <GraphTypeOption mode="state-machine" selected={mode === "state-machine"} onClick={() => setMode("state-machine")} icon={<Network size={18} />} title="상태 머신" description="FSM부터 중첩 HFSM까지 한 문서에서 설계합니다." />
          <GraphTypeOption mode="bt" selected={mode === "bt"} onClick={() => setMode("bt")} icon={<TreePine size={18} />} title="행동 트리" description="선택·순서·조건·행동을 조합합니다." />
        </div>
        <label>
          <span>그래프 이름</span>
          <input autoFocus placeholder={defaultName(mode)} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
        </label>
        <footer>
          <button className="secondary-button" onClick={onClose}>취소</button>
          <button className="primary-button" onClick={submit}>그래프 만들기</button>
        </footer>
      </section>
    </div>
  );
}

function GraphTypeOption({ mode, selected, onClick, icon, title, description }: { mode: GraphMode; selected: boolean; onClick: () => void; icon: ReactNode; title: string; description: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`graph-type-option mode-${mode} ${selected ? "selected" : ""}`} onClick={onClick}>
      <span>{icon}</span><strong>{title}</strong><small>{description}</small>
    </button>
  );
}

function defaultName(mode: GraphMode): string {
  if (mode === "bt") return "새 행동 트리";
  return "새 상태 머신";
}
