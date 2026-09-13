import { error, fail, MatchErrorCode, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { RegExpPattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches a `RegExp` pattern: the interpreted entry point delegates to
 * the same logic as {@link buildRegExp}, so there is a single
 * implementation. */
export function regexp(pattern: RegExpPattern, scope: Scope): AwaitableMatch {
  return buildRegExp(pattern)(scope);
}

/** Compiles a `RegExp` pattern into a flattened, reusable closure. */
export function buildRegExp(pattern: RegExpPattern): CompiledPattern {
  return async (scope: Scope) => {
    if (await scope.stream.done()) {
      return fail(scope, pattern);
    }
    const next = await scope.stream.next();
    const end = scope.withInput(next);
    if (typeof next.value !== "string") {
      return error(
        scope,
        pattern,
        MatchErrorCode.Type,
        `expected value to be a string but got ${typeof next.value}`,
      );
    }

    if (pattern.pattern.test(next.value)) {
      return ok(scope, end, pattern, next.value);
    } else {
      return fail(scope, pattern);
    }
  };
}
