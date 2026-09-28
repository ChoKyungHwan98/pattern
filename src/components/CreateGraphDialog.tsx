import { X } from "lucide-react";
import { useState } from "react";
import type { GraphMode } from "../editor/model";

interface CreateGraphDialogProps {
  onClose: () => void;
  onCreate: (mode: GraphMode, name: string, description?: string) => void;
}

export function CreateGraphDialog({ onClose, onCreate }: CreateGraphDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mode: GraphMode = "state-machine";
  const submit = () => onCreate(mode, name.trim() || defaultName(), description.trim() || undefined);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="pattern-modal graph-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-graph-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>행동 패턴</span><strong id="new-graph-title">새 행동 패턴 만들기</strong></div>
          <button type="button" aria-label="닫기" onClick={onClose}><X size={17} /></button>
        </header>
        <label>
          <span>패턴 이름</span>
          <input autoFocus placeholder={defaultName()} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
        </label>
        <label>
          <span>설명 <small>선택</small></span>
          <input placeholder="예: 경비병 순찰·전투 행동" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>취소</button>
          <button className="primary-button" type="button" onClick={submit}>패턴 만들기</button>
        </footer>
      </section>
    </div>
  );
}

function defaultName(): string {
  return "새 행동 패턴";
}
