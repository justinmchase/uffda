import type { Scope } from "./scope.ts";
import type { AwaitableMatch } from "./awaitable.ts";

/**
 * A pattern node compiled once (see `compile()` in `./match.ts`) into a
 * closure that matches it directly against a `Scope`, without going back
 * through the generic interpreter's per-call `switch (pattern.kind)`
 * dispatch. Kept in its own module (rather than `./match.ts`) so individual
 * pattern files can reference the type without importing `./match.ts`
 * itself.
 */
export type CompiledPattern = (scope: Scope) => AwaitableMatch;
