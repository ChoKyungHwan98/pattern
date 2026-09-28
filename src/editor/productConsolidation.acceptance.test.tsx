import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";

function openSampleEditor() {
  // Prefer explicit sample CTA used by App.test; fall back to nav / card.
  const exact = screen.queryByRole("button", { name: "경비·전투 예제 불러오기" });
  if (exact) {
    fireEvent.click(exact);
    return;
  }
  const navSample = screen.queryByRole("button", { name: "예제 불러오기" });
  if (navSample) {
    fireEvent.click(navSample);
  }
  const card = screen.queryByRole("button", { name: /경비·전투 예제/ });
  if (card) fireEvent.click(card);
}

describe("Product consolidation UX/IA", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("bottom IA exposes exactly 문맥|시뮬레이션|검증|리뷰 and hides algorithm tabs", () => {
    render(<App />);
    openSampleEditor();

    const drawer = document.querySelector(".runtime-drawer") as HTMLElement;
    expect(drawer).toBeTruthy();
    const tabs = within(drawer).getAllByRole("button").filter((button) => {
      const label = button.textContent ?? "";
      return /문맥|시뮬레이션|검증|리뷰/.test(label) && !button.classList.contains("drawer-close");
    });
    // Four primary tabs (counts may append digits)
    const labels = tabs.map((button) => (button.textContent ?? "").replace(/\d+/g, "").trim());
    expect(labels.filter((label) => label.startsWith("문맥")).length).toBeGreaterThan(0);
    expect(labels.filter((label) => label.startsWith("시뮬레이션")).length).toBeGreaterThan(0);
    expect(labels.filter((label) => label === "검증" || label.startsWith("검증")).length).toBeGreaterThan(0);
    expect(labels.filter((label) => label.startsWith("리뷰")).length).toBeGreaterThan(0);

    fireEvent.click(within(drawer).getByRole("button", { name: /^문맥/ }));
    expect(screen.getByTestId("context-panel")).toBeVisible();

    fireEvent.click(within(drawer).getByRole("button", { name: /^시뮬레이션/ }));
    expect(screen.getByTestId("simulation-panel")).toBeVisible();

    expect(within(drawer).queryByRole("button", { name: /Decision Trace/i })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /목표\/계획/ })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /^실행 기록/ })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /행동·조건/ })).not.toBeInTheDocument();

    // Exactly 4 drawer tab buttons with counts (exclude close / engine)
    const drawerTabButtons = Array.from(drawer.querySelectorAll(".drawer-tabs > button:not(.drawer-close)"));
    expect(drawerTabButtons).toHaveLength(4);
  });

  it("create Behavior dialog never asks for FSM/HFSM/BT/Utility/GOAP", () => {
    render(<App />);
    openSampleEditor();
    fireEvent.click(screen.getAllByRole("button", { name: /새 패턴/ })[0]);
    const dialog = screen.getByRole("dialog", { name: /새 행동 패턴 만들기/ });
    expect(dialog).toBeVisible();
    expect(dialog.textContent).not.toMatch(/FSM|HFSM|Utility|GOAP|Behavior Tree|알고리즘/);
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
  });

  it("simulation goal pane uses designer language without GOAP jargon", () => {
    render(<App />);
    openSampleEditor();
    const drawer = document.querySelector(".runtime-drawer") as HTMLElement;
    fireEvent.click(within(drawer).getByRole("button", { name: /^시뮬레이션/ }));
    fireEvent.click(screen.getByRole("tab", { name: "목표·계획" }));
    expect(screen.getByTestId("goal-plan-panel")).toBeVisible();
    expect(screen.getAllByText("현재 상황/문맥").length).toBeGreaterThan(0);
    expect(screen.getAllByText("원하는 결과").length).toBeGreaterThan(0);
    expect(screen.getAllByText("실행 계획").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Goal State/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(World\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Preconditions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Plan Trace$/)).not.toBeInTheDocument();
  });
});
