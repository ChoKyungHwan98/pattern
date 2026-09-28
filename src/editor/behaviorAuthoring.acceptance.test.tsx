/**
 * PR8 — prove empty → shop NPC authoring through the real UI (not a seeded fixture).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { BEHAVIOR_PALETTE } from "./behaviorUi";
import { FLOW_CONDITION_PROMPT, FIRST_SITUATION_CTA, ANYWHERE_INTERRUPT_LABEL } from "./authoringFlow";

function createFreshSet(name = "상점 세트") {
  fireEvent.click(screen.getAllByRole("button", { name: /새 패턴 세트/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("예: 보스 1페이즈 전투 AI"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "만들기" }));
}

function createEmptyBehavior(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name: /새 패턴/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("새 행동 패턴"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "패턴 만들기" }));
}

function addPaletteItem(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "행동 요소 추가" }));
  fireEvent.click(screen.getByRole("menuitem", { name: label }));
}

function renameSelected(name: string) {
  const input = document.querySelector("[data-node-name-input]") as HTMLInputElement | null;
  expect(input).toBeTruthy();
  fireEvent.change(input!, { target: { value: name } });
  fireEvent.blur(input!);
}

function createInlineContext(displayName: string) {
  fireEvent.click(screen.getByTestId("create-context-inline"));
  fireEvent.change(screen.getByLabelText("문맥 표시 이름"), { target: { value: displayName } });
  fireEvent.click(screen.getByTestId("confirm-new-context"));
  // Toast confirms creation (blackboard updated without wiping graph).
  expect(screen.getByRole("status").textContent ?? "").toContain(displayName);
}

describe("PR8 Behavior Authoring Flow — 상점 NPC", () => {
  beforeEach(() => window.localStorage.clear());

  it("palette is Situation/Action/Decision only with planner copy", () => {
    expect(BEHAVIOR_PALETTE.map((item) => item.label)).toEqual(["상황", "행동", "판단"]);
    expect(BEHAVIOR_PALETTE.map((item) => item.shortDescription)).toEqual([
      "캐릭터가 지금 어떤 상태인지",
      "캐릭터가 실제로 무엇을 하는지",
      "여러 행동 중 무엇을 할지 고르는 지점",
    ]);
  });

  it("after create shows 첫 상황 만들기 and never Any State / algorithm picker", () => {
    render(<App />);
    createFreshSet();
    fireEvent.click(screen.getAllByRole("button", { name: /새 패턴/ })[0]);
    const dialog = screen.getByRole("dialog", { name: /새 행동 패턴 만들기/ });
    expect(dialog.textContent).not.toMatch(/FSM|HFSM|Utility|GOAP|Behavior Tree|알고리즘|Any State/);
    fireEvent.change(screen.getByPlaceholderText("새 행동 패턴"), { target: { value: "상점 NPC" } });
    fireEvent.click(screen.getByRole("button", { name: "패턴 만들기" }));

    expect(screen.getByTestId("first-situation-cta")).toBeVisible();
    expect(screen.getByText(FIRST_SITUATION_CTA.headline)).toBeVisible();
    expect(screen.queryByText("Any State")).not.toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(ANYWHERE_INTERRUPT_LABEL)).length).toBeGreaterThan(0);
  });

  it("authors shop NPC end-to-end: wait ↔ greet + anywhere attack→flee", () => {
    render(<App />);
    createFreshSet("상점 저작");
    createEmptyBehavior("상점 NPC");

    // B) first situation
    fireEvent.click(screen.getByTestId("first-situation-cta"));
    expect(screen.queryByTestId("first-situation-cta")).not.toBeInTheDocument();
    renameSelected("대기");

    addPaletteItem("상황");
    renameSelected("인사");
    addPaletteItem("상황");
    renameSelected("도망");

    // C) connect 대기 → 인사
    fireEvent.click(screen.getAllByText("대기")[0]);
    const quickConnect = screen.getByTestId("quick-connect") as HTMLSelectElement;
    const greetOption = Array.from(quickConnect.options).find((item) => item.textContent?.startsWith("인사"));
    expect(greetOption).toBeTruthy();
    fireEvent.change(quickConnect, { target: { value: greetOption!.value } });
    expect(screen.getByText("흐름 조건")).toBeVisible();
    expect(screen.getByText(FLOW_CONDITION_PROMPT)).toBeVisible();
    createInlineContext("가까움");

    // Also connect 인사 → 대기 (player leaves)
    fireEvent.click(screen.getAllByText("인사")[0]);
    const quickConnect2 = screen.getByTestId("quick-connect") as HTMLSelectElement;
    const waitOption = Array.from(quickConnect2.options).find((item) => item.textContent?.startsWith("대기"));
    expect(waitOption).toBeTruthy();
    fireEvent.change(quickConnect2, { target: { value: waitOption!.value } });
    expect(screen.getByText(FLOW_CONDITION_PROMPT)).toBeVisible();
    // Reuse existing 가까움 from select (false path can be set later in sim)
    const contextSelect = screen.getByLabelText("문맥 값") as HTMLSelectElement;
    fireEvent.change(contextSelect, { target: { value: "가까움" } });

    // E) 어떤 상황에서도 → 도망 + 공격받음
    fireEvent.click(screen.getAllByText("도망")[0]);
    fireEvent.click(screen.getByTestId("anywhere-interrupt-button"));
    expect(screen.getByText(FLOW_CONDITION_PROMPT)).toBeVisible();
    expect(screen.getAllByText("어떤 상황에서도").length).toBeGreaterThan(0);
    expect(screen.queryByText("Any State")).not.toBeInTheDocument();
    createInlineContext("공격받음");

    // D) 행동 / 판단
    addPaletteItem("행동");
    renameSelected("인사하기");
    addPaletteItem("판단");
    renameSelected("응대 판단");
    expect(screen.getAllByText("인사하기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("응대 판단").length).toBeGreaterThan(0);

    // F) 문맥 + 시뮬레이션 tabs
    fireEvent.click(screen.getByRole("button", { name: /^문맥/ }));
    expect(screen.getByTestId("context-panel")).toBeVisible();
    const panelText = screen.getByTestId("context-panel").textContent ?? "";
    // Prefer display values; fall back to panel text if inputs use key-only legacy path.
    const hasNear = screen.queryAllByDisplayValue("가까움").length > 0 || panelText.includes("가까움");
    const hasAttack = screen.queryAllByDisplayValue("공격받음").length > 0 || panelText.includes("공격받음");
    expect(hasNear).toBe(true);
    expect(hasAttack).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^시뮬레이션/ }));
    expect(screen.getByRole("button", { name: /^시뮬레이션/ })).toBeVisible();

    const drawer = document.querySelector(".runtime-drawer") as HTMLElement;
    const tabs = Array.from(drawer.querySelectorAll(".drawer-tabs > button:not(.drawer-close)"));
    expect(tabs.map((button) => button.textContent ?? "").join("|")).toMatch(/문맥.*시뮬레이션.*검증.*리뷰/);
  });

  it("rejects invalid authoring links with planner explanation", async () => {
    const { classifyAuthoringLink } = await import("./authoringFlow");
    const { createGraph } = await import("./patternLibrary");
    const { createDomainGraphNode } = await import("./domain");
    let graph = createGraph("state-machine", "x");
    const action = createDomainGraphNode({
      mode: "state-machine",
      entityKind: "action",
      index: 1,
      scopeId: graph.rootScopeId,
      position: { x: 0, y: 0 },
      id: "a",
    });
    const sit = createDomainGraphNode({
      mode: "state-machine",
      entityKind: "state",
      index: 2,
      scopeId: graph.rootScopeId,
      position: { x: 1, y: 0 },
      id: "s",
    });
    graph = { ...graph, nodes: [...graph.nodes, action, sit] };
    const result = classifyAuthoringLink(graph, "a", "s");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/판단/);
  });
});
