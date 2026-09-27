import { defineMetadata } from "../value_metadata.ts";

/**
 * Length-1 list collapse for pattern wrappers (conversion blocker B4).
 *
 * When `items` has a single element, return that element. Otherwise return
 * `full` (the complete wrapper value). Authors write e.g.
 * `(one (flat _) { kind: "and", patterns: (flat _) })`.
 *
 * Required for modules in PatternLang import cycles where `Tail+ | child`
 * backtracking is unsafe under left recursion.
 */
export function one(items: unknown[], full: unknown): unknown {
  if (Array.isArray(items) && items.length === 1) {
    return items[0];
  }
  return full;
}

defineMetadata(one, {
  description: "The only element of a one-element list, otherwise full.",
  parameters: [{ name: "items" }, { name: "full" }],
});
