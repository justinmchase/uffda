/**
 * Marker for std helpers that receive the current MatchOk as their first
 * argument when invoked from ExpressionLang.
 */
export const MATCH_AWARE = Symbol.for("uffda.matchAware");

export type MatchAwareFn =
  & ((
    // deno-lint-ignore no-explicit-any
    ...args: any[]
  ) => unknown)
  & { [MATCH_AWARE]?: true };

export function isMatchAware(fn: unknown): fn is MatchAwareFn {
  return typeof fn === "function" &&
    (fn as MatchAwareFn)[MATCH_AWARE] === true;
}

export function markMatchAware<T extends MatchAwareFn>(fn: T): T {
  fn[MATCH_AWARE] = true;
  return fn;
}
