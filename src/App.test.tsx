import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("pattern library and editor", () => {
  beforeEach(() => window.localStorage.clear());

  it("패턴 세트 안에 같은 종류의 그래프를 여러 개 만든다", () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /새 패턴 세트/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("예: 보스 1페이즈 전투 AI"), { target: { value: "보스 전투" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));

    expect(screen.getAllByText("보스 전투").length).toBeGreaterThan(0);
    createGraphThroughDialog("Animator FSM");
    createGraphThroughDialog("몬스터 AI FSM");

    expect(screen.getAllByText("Animator FSM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("몬스터 AI FSM").length).toBeGreaterThan(0);
  });

  it("한 세트에서 평면·계층 상태 머신과 행동 트리를 함께 관리한다", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "경비·전투 예제 불러오기" }));

    // Default list shows 경비 행동 only; legacy FSM/HFSM/BT sit under 고급 · 레거시 예제.
    expect(screen.getAllByRole("button", { name: /경비 행동/ })[0]).toBeVisible();
    expect(screen.queryByRole("button", { name: /Cinder Knight FSM/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("고급 · 레거시 예제"));
    expect(screen.getAllByRole("button", { name: /Cinder Knight FSM/ })[0]).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Cinder Knight Combat HFSM/ })[0]).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: /Cinder Knight Behavior Tree/ })[0]);
    expect(screen.getAllByText("행동 캔버스").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Combat Root").length).toBeGreaterThan(0);
  });

  it("패턴 세트를 저장하고 다시 열 수 있다", () => {
    const view = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /새 패턴 세트/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("예: 보스 1페이즈 전투 AI"), { target: { value: "플레이어 로코모션" } });
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    fireEvent.click(screen.getByRole("button", { name: /세트 목록/ }));
    expect(screen.getByRole("button", { name: /플레이어 로코모션/ })).toBeVisible();

    view.unmount();
    render(<App />);
    expect(screen.getByRole("button", { name: /플레이어 로코모션/ })).toBeVisible();
  });

  it("Unity 방식 단축키로 노드를 복제·삭제·복구한다", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "경비·전투 예제 불러오기" }));

    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    expect(screen.getAllByText("순찰 복사본").length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "Delete" });
    expect(screen.queryByText("순찰 복사본")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getAllByText("순찰 복사본").length).toBeGreaterThan(0);
  });

  it("편집기 안에서 단축키 목록을 확인할 수 있다", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "경비·전투 예제 불러오기" }));
    fireEvent.click(screen.getByRole("button", { name: "단축키" }));

    expect(screen.getByRole("dialog", { name: "편집기 단축키" })).toBeVisible();
    expect(screen.getByText("선택한 노드 또는 전환 삭제")).toBeVisible();
  });

  it("전환 선택 상태에서 Delete로 지우고 Undo로 복구한다", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "경비·전투 예제 불러오기" }));
    fireEvent.click(screen.getByRole("button", { name: /나감.*경계.*플레이어 발견/ }));
    expect(screen.getByText("흐름 조건")).toBeVisible();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(screen.queryByText("흐름 조건")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByText("흐름 조건")).toBeVisible();
  });

  it("입력 중 Delete는 노드를 지우지 않고 Ctrl+S는 앱 저장으로 처리한다", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "경비·전투 예제 불러오기" }));
    const nameInput = document.querySelector("[data-node-name-input]") as HTMLInputElement;
    expect(nameInput?.value).toBe("순찰");
    nameInput.focus();

    fireEvent.keyDown(nameInput, { key: "Delete" });
    expect(screen.getAllByText("순찰").length).toBeGreaterThan(0);

    const notCancelled = fireEvent.keyDown(nameInput, { key: "s", ctrlKey: true });
    expect(notCancelled).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("현재 작업을 저장했습니다.");
  });
    it("Behavior Canvas palette shows Situation/Action/Decision and hides Entry/Any State", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "경비·전투 예제 불러오기" }));
    fireEvent.click(screen.getByRole("button", { name: "행동 요소 추가" }));
    expect(screen.getByRole("menuitem", { name: "상황" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "행동" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "판단" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "조건" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "문맥 값" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Entry/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Any State")).not.toBeInTheDocument();
  });

});

function createGraphThroughDialog(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name: /새 패턴/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("새 행동 패턴"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "패턴 만들기" }));
}
