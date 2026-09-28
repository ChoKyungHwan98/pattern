import { FolderPlus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { PatternSet } from "../editor/model";

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
    <div className="pattern-home studio-home-shell">
      <aside className="studio-home-nav">
        <div className="studio-home-brand"><b>패턴 디자이너</b></div>
        <div className="studio-nav-group">
          <span>프로젝트 관리</span>
          <nav aria-label="프로젝트 관리">
            <button className="is-active" type="button"><b>전체 프로젝트</b></button>
          </nav>
        </div>
        <div className="studio-nav-group studio-ai-nav">
          <nav aria-label="도구 메뉴">
            <button type="button" onClick={() => setCreateOpen(true)}><b>새 패턴 세트</b></button>
            <button type="button" onClick={onSampleCreate}><b>예제 불러오기</b></button>
          </nav>
        </div>
      </aside>

      <main className="studio-home-main">
        <header className="studio-home-heading">
          <h1>전체 프로젝트</h1>
          <div className="studio-home-actions">
            <input
              className="studio-home-search"
              aria-label="프로젝트 검색"
              placeholder="프로젝트 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> 새 패턴 세트
            </button>
          </div>
        </header>

        {filteredSets.length ? (
          <section className="pattern-set-grid" aria-label="전체 프로젝트">
            {filteredSets.map((set) => (
              <button className="pattern-set-card" key={set.id} type="button" onClick={() => onOpen(set.id)}>
                <div className="pattern-set-preview" aria-hidden="true">
                  <i>패턴 세트</i>
                  <b>{set.name}</b>
                  <span />
                </div>
                <div className="pattern-set-copy">
                  <strong>{set.name}</strong>
                  <small>{set.description || graphSummary(set)}</small>
                  <time dateTime={set.updatedAt}>{formatUpdatedAt(set.updatedAt)}</time>
                </div>
              </button>
            ))}
          </section>
        ) : (
          <section className="pattern-set-grid" aria-label="전체 프로젝트">
            <div className="library-empty">
              <span><FolderPlus size={27} /></span>
              <strong>{sets.length ? "검색 결과가 없습니다." : "아직 패턴 세트가 없습니다."}</strong>
              <p>{sets.length ? "다른 이름으로 검색해 보세요." : "업무 단위를 먼저 만들고 그 안에 필요한 행동 패턴을 추가하세요."}</p>
              {!sets.length && (
                <div className="empty-actions">
                  <button className="home-primary-button" type="button" onClick={() => setCreateOpen(true)}>
                    <Plus size={15} /> 첫 패턴 세트 만들기
                  </button>
                  <button className="home-secondary-button" type="button" onClick={onSampleCreate}>
                    경비·전투 예제 불러오기
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {createOpen && (
        <div className="modal-backdrop home-modal-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section className="pattern-modal home-modal" role="dialog" aria-modal="true" aria-labelledby="new-set-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>새 작업 단위</span><strong id="new-set-title">패턴 세트 만들기</strong></div>
              <button type="button" aria-label="닫기" onClick={() => setCreateOpen(false)}><X size={17} /></button>
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
              <button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>취소</button>
              <button className="primary-button" type="button" disabled={!name.trim()} onClick={submit}>만들기</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function graphSummary(set: PatternSet): string {
  const count = set.graphs.length;
  return count ? `행동 패턴 ${count}` : "패턴 없음";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 수정";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

