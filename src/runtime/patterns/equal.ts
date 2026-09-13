import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { EqualPattern } from "./pattern.ts";
import { resolveValueSource } from "./value_source.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches an `Equal` pattern: the interpreted entry point delegates to
 * the same logic as {@link buildEqual}, so there is a single
 * implementation. */
export function equal(pattern: EqualPattern, scope: Scope): AwaitableMatch {
  return buildEqual(pattern)(scope);
}

/** Compiles an `Equal` pattern into a flattened, reusable closure. */
export function buildEqual(pattern: EqualPattern): CompiledPattern {
  return async (scope: Scope) => {
    const resolved = resolveValueSource(pattern.value, scope, pattern);
    if (resolved.kind === "error") {
      return resolved.match;
    }
    const value = resolved.value;

    if (await scope.stream.done()) {
      return fail(scope, pattern);
    }

    const next = await scope.stream.next();
    const end = scope.withInput(next);
    if (next.value === value) {
      return ok(scope, end, pattern, next.value);
    } else {
      return fail(scope, pattern);
    }
  };
}
