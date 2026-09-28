import { Keyboard, X } from "lucide-react";

const shortcutGroups = [
  {
    title: "편집",
    commands: [
      ["Ctrl + Z", "실행 취소"],
      ["Ctrl + Y", "다시 실행"],
      ["Ctrl + C / X / V", "복사 / 잘라내기 / 붙여넣기"],
      ["Ctrl + D", "선택한 노드 복제"],
      ["Delete", "선택한 노드 또는 전환 삭제"],
      ["F2", "선택한 노드 이름 변경"],
    ],
  },
  {
    title: "탐색",
    commands: [
      ["F", "선택한 노드 화면에 맞춤"],
      ["Shift + F", "그래프 전체 보기"],
      ["Ctrl + F", "그래프와 노드 검색"],
      ["Esc", "선택 또는 열린 창 닫기"],
    ],
  },
  {
    title: "실행",
    commands: [
      ["Ctrl + P", "시뮬레이션 실행 / 중지"],
      ["Ctrl + Shift + P", "일시 정지 / 계속"],
      ["Ctrl + Alt + P", "한 단계 실행"],
      ["Ctrl + S", "현재 자동 저장 상태 확인"],
    ],
  },
];

export function ShortcutHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop shortcut-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-dialog-title">
        <header>
          <span><Keyboard size={17} /></span>
          <div>
            <strong id="shortcut-dialog-title">편집기 단축키</strong>
            <small>행동 캔버스 편집 단축키</small>
          </div>
          <button aria-label="단축키 닫기" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="shortcut-groups">
          {shortcutGroups.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.commands.map(([keys, label]) => (
                  <div key={keys}>
                    <dt>{label}</dt>
                    <dd>{keys.split(" + ").map((key) => <kbd key={key}>{key}</kbd>)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer>입력 중에는 텍스트 편집 키가 우선하며, 저장·검색·실행 단축키는 항상 동작합니다.</footer>
      </section>
    </div>
  );
}
