/**
 * Planner-facing display names for stable context / world-fact keys.
 * Keys stay English in data + runtime; UI shows Korean labels.
 * Raw keys appear only under 고급.
 */

export const CONTEXT_KEY_DISPLAY_NAMES: Record<string, string> = {
  HasTarget: "대상 발견됨",
  InAttackRange: "공격 범위 안",
  Approaching: "접근 중",
  Dashed: "대시 완료",
  CooldownReady: "쿨다운 준비",
  TargetActor: "대상 액터",
  DistanceToTarget: "대상까지 거리",
  HasLineOfSight: "시야 확보",
  SelectedAttack: "선택한 공격",
  HeavySlamCooldown: "강타 쿨다운",
  WasInterrupted: "중단됨",
  NotStaggered: "경직 아님",
};

export function contextKeyDisplayName(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  return CONTEXT_KEY_DISPLAY_NAMES[trimmed] ?? trimmed;
}

/** Fact line for planner UI e.g. "대상 발견됨=true". */
export function formatContextFact(key: string, value: unknown): string {
  return `${contextKeyDisplayName(key)}=${String(value)}`;
}

/** World / context map as readable Korean facts. */
export function formatContextState(state: Record<string, unknown>): string {
  const entries = Object.entries(state);
  if (entries.length === 0) return "(비어 있음)";
  return entries.map(([key, value]) => formatContextFact(key, value)).join(", ");
}

/** Advanced-only: show display + raw key when they differ. */
export function contextKeyAdvancedLabel(key: string): string {
  const display = contextKeyDisplayName(key);
  return display === key ? key : `${display} (${key})`;
}