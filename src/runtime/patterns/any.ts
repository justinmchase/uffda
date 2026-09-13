import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { AnyPattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches an `Any` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildAny}, so there is a single implementation. */
export function any(pattern: AnyPattern, scope: Scope): AwaitableMatch {
  return buildAny(pattern)(scope);
}

/** Compiles an `Any` pattern into a flattened, reusable closure. */
export function buildAny(pattern: AnyPattern): CompiledPattern {
  return async (scope: Scope) => {
    if (await scope.stream.done()) {
      return fail(scope, pattern);
    }
    const next = await scope.stream.next();
    const end = scope.withInput(next);
    return ok(scope, end, pattern, next.value);
  };
}
