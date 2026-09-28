/**
 * PR8 — Behavior authoring flow helpers (planner language, no new algorithms).
 * Connection rules, empty-canvas CTA, and inline context-variable creation.
 */

import { resolveDomainEntityKind } from "./domain";
import type { BlackboardEntry, GraphDefinition, GraphNode } from "./model";
import { isSystemNode } from "./stateMachine";

export type AuthoringRole = "situation" | "action" | "decision" | "condition" | "system" | "other";

export type AuthoringLinkKind =
  | "situation-flow"
  | "situation-decision"
  | "decision-action"
  | "interrupt"
  | "exit-return"
  | "invalid";

export interface AuthoringLinkResult {
  ok: boolean;
  kind: AuthoringLinkKind;
  /** Planner-facing explanation (especially for invalid links). */
  message: string;
  /** After a successful flow connect, focus condition authoring. */
  promptCondition?: boolean;
}

export const FIRST_SITUATION_CTA = {
  title: "첫 상황 만들기",
  headline: "아직 상황이 없습니다",
  body: "캐릭터가 지금 어떤 상태인지부터 정해 보세요. 예: 대기, 응대, 도망",
  buttonLabel: "첫 상황 만들기",
} as const;

export const FLOW_CONDITION_PROMPT = "언제 이 흐름을 타는가?";

export const ANYWHERE_INTERRUPT_LABEL = "어떤 상황에서도";

export function authoringRole(node: GraphNode | undefined): AuthoringRole {
  if (!node) return "other";
  if (isSystemNode(node)) return "system";
  if (node.kind === "condition") return "condition";
  if (node.kind === "submachine") return "situation";
  const entity = resolveDomainEntityKind(node);
  if (entity === "state" || (!entity && node.kind === "state")) return "situation";
  if (entity === "action" || node.kind === "task") return "action";
  if (entity === "decision" || node.kind === "selector") return "decision";
  return "other";
}

export function classifyAuthoringLink(
  graph: GraphDefinition,
  sourceId: string,
  targetId: string,
): AuthoringLinkResult {
  if (sourceId === targetId) {
    return { ok: false, kind: "invalid", message: "같은 요소로는 흐름을 만들 수 없습니다." };
  }
  const source = graph.nodes.find((node) => node.id === sourceId);
  const target = graph.nodes.find((node) => node.id === targetId);
  if (!source || !target) {
    return { ok: false, kind: "invalid", message: "연결할 요소를 찾을 수 없습니다." };
  }

  const from = authoringRole(source);
  const to = authoringRole(target);

  if (source.kind === "any") {
    if (to === "situation") {
      return {
        ok: true,
        kind: "interrupt",
        message: `${ANYWHERE_INTERRUPT_LABEL} → ‘${target.name}’으로 이동합니다. 조건을 적어 주세요.`,
        promptCondition: true,
      };
    }
    return {
      ok: false,
      kind: "invalid",
      message: `${ANYWHERE_INTERRUPT_LABEL} 규칙은 상황으로만 연결할 수 있습니다.`,
    };
  }

  if (target.kind === "exit") {
    if (from === "situation") {
      return {
        ok: true,
        kind: "exit-return",
        message: `‘${source.name}’에서 종료/복귀합니다.`,
      };
    }
    return {
      ok: false,
      kind: "invalid",
      message: "종료/복귀는 상황에서만 연결할 수 있습니다.",
    };
  }

  if (from === "system" || to === "system") {
    return {
      ok: false,
      kind: "invalid",
      message: "시스템 요소로는 직접 연결하지 마세요. 「어떤 상황에서도」 버튼을 사용하세요.",
    };
  }

  if (from === "situation" && to === "situation") {
    return {
      ok: true,
      kind: "situation-flow",
      message: `‘${source.name}’ → ‘${target.name}’. ${FLOW_CONDITION_PROMPT}`,
      promptCondition: true,
    };
  }

  if (from === "situation" && to === "decision") {
    return {
      ok: true,
      kind: "situation-decision",
      message: `‘${source.name}’에서 판단 ‘${target.name}’으로. ${FLOW_CONDITION_PROMPT}`,
      promptCondition: true,
    };
  }

  if (from === "decision" && to === "action") {
    return {
      ok: true,
      kind: "decision-action",
      message: `판단 ‘${source.name}’의 후보 행동 ‘${target.name}’으로 연결했습니다.`,
    };
  }

  if (from === "situation" && to === "action") {
    return {
      ok: false,
      kind: "invalid",
      message: "상황에서는 바로 행동으로 잇지 않습니다. 다른 상황이나 판단을 연결하세요.",
    };
  }

  if (from === "action") {
    return {
      ok: false,
      kind: "invalid",
      message: "행동은 판단의 후보로만 연결합니다. 판단 → 행동으로 이어 주세요.",
    };
  }

  if (from === "decision" && to === "situation") {
    return {
      ok: false,
      kind: "invalid",
      message: "판단에서는 행동을 고릅니다. 판단 → 행동으로 연결하세요.",
    };
  }

  if (from === "decision" && to === "decision") {
    return {
      ok: false,
      kind: "invalid",
      message: "판단끼리 직접 잇지 않습니다. 각 판단에서 행동 후보를 연결하세요.",
    };
  }

  if (from === "condition" || to === "condition") {
    return {
      ok: false,
      kind: "invalid",
      message: "조건은 흐름 선에서 「언제 이 흐름을 타는가?」로 적습니다. 그래프 노드로 두지 마세요.",
    };
  }

  return {
    ok: false,
    kind: "invalid",
    message: `‘${source.name}’ → ‘${target.name}’ 연결은 지원하지 않습니다. 상황→상황, 상황→판단, 판단→행동만 가능합니다.`,
  };
}

/** Hangul/spaces → safe key; keep existing Latin keys. */
export function suggestContextKeyFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "contextValue";
  const latin = trimmed.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
  if (/^[A-Za-z][\w]*$/.test(latin)) return latin;
  // Planner-friendly Korean keys are allowed (기존 샘플과 동일).
  return trimmed.replace(/\s+/g, "");
}

export function createContextVariableEntry(
  displayName: string,
  options?: Partial<BlackboardEntry> & { existingKeys?: string[] },
): BlackboardEntry {
  const name = displayName.trim() || "새 문맥 값";
  let key = (options?.key?.trim() || suggestContextKeyFromDisplayName(name));
  const existing = new Set(options?.existingKeys ?? []);
  if (existing.has(key)) {
    let suffix = 2;
    while (existing.has(`${key}${suffix}`)) suffix += 1;
    key = `${key}${suffix}`;
  }
  const type = options?.type ?? "Bool";
  const defaultValue = options?.defaultValue ?? (type === "Bool" ? "false" : "0");
  return {
    key,
    displayName: name,
    type,
    defaultValue,
    liveValue: options?.liveValue ?? defaultValue,
    source: options?.source ?? "작성",
    description: options?.description,
    enumValues: options?.enumValues,
  };
}

export function contextEntryLabel(entry: BlackboardEntry): string {
  const display = entry.displayName?.trim();
  return display || entry.key;
}

export function isBehaviorCanvasEmpty(graph: GraphDefinition, scopeId?: string): boolean {
  const scope = scopeId ?? graph.rootScopeId;
  return !graph.nodes.some((node) => {
    if (isSystemNode(node)) return false;
    if (graph.mode === "bt") return true;
    return node.scopeId === scope;
  });
}
