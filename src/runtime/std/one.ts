/**
 * Length-1 list collapse for pattern wrappers (conversion blocker B4).
 *
 * When `items` has a single element, return that element. Otherwise return
 * `{ [key]: items, kind }` so Then/And/Or/Pipeline authors can use `Tail*`
 * without Native ternaries. Required for modules in PatternLang import cycles
 * where `Tail+ | child` backtracking is unsafe under left recursion.
 */
export function one(
  items: unknown[],
  kind: string,
  key = "patterns",
): unknown {
  if (items.length === 1) {
    return items[0];
  }
  return { kind, [key]: items };
}
