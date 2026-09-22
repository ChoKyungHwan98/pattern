import { ArrowRight, Braces, FolderPlus, Network, Plus, TreePine, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { GraphMode, PatternSet } from "../editor/model";

interface PatternSetLibraryProps {
  sets: PatternSet[];
  onCreate: (name: string, description: string) => void;
  onOpen: (setId: string) => void;
  onSampleCreate: () => void;
}

export function PatternSetLibrary({
  sets,
  onCreate,
  onOpen,
  onSampleCreate,
}: PatternSetLibraryProps) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const filteredSets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sets;
    return sets.filter((set) =>
      `${set.name} ${set.description ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [query, sets]);

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name, description);
    setName("");
    setDescription("");
    setCreateOpen(false);
  };

  return (
    <div className="pattern-library">
      <header className="library-header">
        <div className="library-title">
          <span className="library-product-mark"><Braces size={19} /></span>
          <div>
            <strong>패턴 디자이너</strong>
            <span>게임플레이 로직 작업공간</span>
          </div>
        </div>
        <button className="primary-button" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> 새 패턴 세트
        </button>
      </header>

      <main className="library-content">
        <section className="library-intro">
          <span>패턴 세트</span>
          <h1>어떤 시스템을 설계할까요?</h1>
          <p>몬스터, 플레이어, 보스전처럼 하나의 업무 단위에 필요한 상태 머신과 행동 트리를 함께 관리합니다.</p>
        </section>

        <div className="library-toolbar">
          <input
            aria-label="패턴 세트 검색"
            placeholder="패턴 세트 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span>{filteredSets.length}개</span>
        </div>

        {filteredSets.length ? (
          <section className="pattern-set-grid" aria-label="패턴 세트 목록">
            {filteredSets.map((set) => (
              <button className="pattern-set-card" key={set.id} onClick={() => onOpen(set.id)}>
                <div className="pattern-set-card-top">
                  <span className="set-folder"><FolderPlus size={20} /></span>
                  <span className="updated-at">{formatUpdatedAt(set.updatedAt)}</span>
                </div>
                <strong>{set.name}</strong>
                <p>{set.description || "설명 없음"}</p>
                <div className="set-graph-counts">
                  <GraphCount mode="state-machine" count={set.graphs.filter((graph) => graph.mode === "state-machine").length} />
                  <GraphCount mode="bt" count={set.graphs.filter((graph) => graph.mode === "bt").length} />
                  <ArrowRight className="set-open-arrow" size={16} />
                </div>
              </button>
            ))}
          </section>
        ) : (
          <section className="library-empty">
            <span><FolderPlus size={27} /></span>
            <strong>{sets.length ? "검색 결과가 없습니다." : "아직 패턴 세트가 없습니다."}</strong>
            <p>{sets.length ? "다른 이름으로 검색해 보세요." : "업무 단위를 먼저 만들고 그 안에 필요한 그래프를 추가하세요."}</p>
            {!sets.length && (
              <div className="empty-actions">
                <button className="primary-button" onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> 첫 패턴 세트 만들기
                </button>
                <button className="secondary-button" onClick={onSampleCreate}>Cinder Knight 예제 불러오기</button>
              </div>
            )}
          </section>
        )}
      </main>

      {createOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section className="pattern-modal" role="dialog" aria-modal="true" aria-labelledby="new-set-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>새 작업 단위</span><strong id="new-set-title">패턴 세트 만들기</strong></div>
              <button aria-label="닫기" onClick={() => setCreateOpen(false)}><X size={17} /></button>
            </header>
            <label>
              <span>이름</span>
              <input autoFocus placeholder="예: 보스 1페이즈 전투 AI" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} />
            </label>
            <label>
              <span>설명 <small>선택</small></span>
              <input placeholder="이 세트에서 다룰 범위" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <footer>
              <button className="secondary-button" onClick={() => setCreateOpen(false)}>취소</button>
              <button className="primary-button" disabled={!name.trim()} onClick={submit}>만들기</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function GraphCount({ mode, count }: { mode: GraphMode; count: number }) {
  return (
    <span className={`graph-count mode-${mode}`}>
      {mode === "state-machine" && <Network size={12} />}
      {mode === "bt" && <TreePine size={12} />}
      {mode === "bt" ? "BT" : "상태 머신"} {count}
    </span>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 수정";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}
