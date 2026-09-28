import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { BEHAVIOR_PALETTE, canvasNodeKindName, decisionCanvasBrief } from "./behaviorUi";
import { createSamplePatternSet } from "./patternLibrary";
import { createGuardBehaviorGraph } from "./sampleProject";

function openSample() {
  const exact = screen.queryByRole("button", { name: "경비·전투 예제 불러오기" });
  if (exact) {
    fireEvent.click(exact);
    return;
  }
  fireEvent.click(screen.getByRole("button", { name: "예제 불러오기" }));
  const card = screen.queryByRole("button", { name: /경비·전투 예제/ });
  if (card) fireEvent.click(card);
}

describe("PR7 Designer Language & Product Cleanup", () => {
  beforeEach(() => window.localStorage.clear());

  it("default sample list centers 경비 행동 and hides FSM/HFSM/BT until legacy section opens", () => {
    const set = createSamplePatternSet();
    expect(set.graphs[0]?.name).toBe("경비 행동");
    expect(set.graphs.filter((graph) => !graph.legacyExample).map((graph) => graph.name)).toEqual(["경비 행동"]);
    expect(set.graphs.filter((graph) => graph.legacyExample).length).toBe(3);

    render(<App />);
    openSample();
    expect(screen.getAllByRole("button", { name: /경비 행동/ })[0]).toBeVisible();
    expect(screen.queryByRole("button", { name: /Cinder Knight FSM/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/유틸리티/)).not.toBeInTheDocument();
    const primaryList = screen.getByRole("navigation", { name: "행동 패턴 목록" });
    expect(primaryList.textContent ?? "").not.toMatch(/FSM|HFSM|Behavior Tree|Utility|GOAP|XState|Mistreevous/);
  });

  it("inspector decision mode uses 고려 요인 비교 without Utility jargon", () => {
    render(<App />);
    openSample();
    fireEvent.click(screen.getAllByText("행동 판단")[0]);
    expect(screen.getByText("고려 요인 비교")).toBeVisible();
    expect(screen.queryByText(/유틸리티/)).not.toBeInTheDocument();
  });

  it("create Behavior first screen has no algorithm picker", () => {
    render(<App />);
    openSample();
    fireEvent.click(screen.getAllByRole("button", { name: /새 패턴/ })[0]);
    const dialog = screen.getByRole("dialog", { name: /새 행동 패턴 만들기/ });
    expect(dialog.textContent).not.toMatch(/FSM|HFSM|Utility|GOAP|Behavior Tree|유틸리티|알고리즘/);
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("palette and decision canvas use planner language only", () => {
    expect(BEHAVIOR_PALETTE.map((item) => item.label)).toEqual(["상황", "행동", "판단"]);
    const decide = createGuardBehaviorGraph().nodes.find((node) => node.name === "행동 판단")!;
    expect(canvasNodeKindName(decide)).toBe("판단");
    expect(decisionCanvasBrief(decide)?.headline).toMatch(/^판단/);
    expect(decisionCanvasBrief(decide)?.headline).not.toMatch(/유틸리티|Utility|GOAP/);
  });

  it("bottom tabs stay 문맥|시뮬레이션|검증|리뷰", () => {
    render(<App />);
    openSample();
    const drawer = document.querySelector(".runtime-drawer") as HTMLElement;
    const drawerTabButtons = Array.from(drawer.querySelectorAll(".drawer-tabs > button:not(.drawer-close)"));
    expect(drawerTabButtons).toHaveLength(4);
    const blob = drawerTabButtons.map((button) => button.textContent ?? "").join("|");
    expect(blob).toMatch(/문맥/);
    expect(blob).toMatch(/시뮬레이션/);
    expect(blob).toMatch(/검증/);
    expect(blob).toMatch(/리뷰/);
    expect(blob).not.toMatch(/Decision Trace|Goal Plan|GOAP/);
  });
});