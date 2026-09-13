import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { EndPattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches an `End` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildEnd}, so there is a single implementation. */
export function end(pattern: EndPattern, scope: Scope): AwaitableMatch {
  return buildEnd(pattern)(scope);
}

/** Compiles an `End` pattern into a flattened, reusable closure. */
export function buildEnd(pattern: EndPattern): CompiledPattern {
  return async (scope: Scope) => {
    if (await scope.stream.done()) {
      return ok(scope, scope, pattern);
    } else {
      return fail(scope, pattern);
    }
  };
}
