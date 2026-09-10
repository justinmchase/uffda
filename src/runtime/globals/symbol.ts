/**
 * Well-known symbol names (`iterator`, `asyncIterator`, `toStringTag`, …)
 * are the static properties on the `Symbol` constructor whose values are
 * themselves symbols. Computed once so `(symbol "iterator")` always
 * resolves to the exact same built-in `Symbol.iterator` singleton.
 */
const wellKnownSymbolNames = new Set(
  Object.getOwnPropertyNames(Symbol).filter(
    (name) =>
      typeof (Symbol as unknown as Record<string, unknown>)[name] ===
        "symbol",
  ),
);

/**
 * Resolves a symbol by name.
 *
 * - Well-known names (e.g. `"iterator"`, `"asyncIterator"`) return the
 *   actual built-in singleton (`Symbol.iterator`), which is always the
 *   same value.
 * - Any other name returns `Symbol.for(name)`, the global symbol
 *   registry, which is also always the same value for the same name.
 *
 * Either way, calling `(symbol "name")` with the same `name` always
 * yields a referentially identical symbol; plain `Symbol(name)` is
 * intentionally never used here, since it would mint a new, distinct
 * symbol on every call.
 */
export function symbol(name: string): symbol {
  if (wellKnownSymbolNames.has(name)) {
    return (Symbol as unknown as Record<string, symbol>)[name];
  }
  return Symbol.for(name);
}
