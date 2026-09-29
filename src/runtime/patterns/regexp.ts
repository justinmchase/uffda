import { error, fail, MatchErrorCode, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { RegExpPattern } from "./pattern.ts";
import { rawOf } from "../../wrapped.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `RegExp` pattern into a flattened, reusable closure. */
export function regexp(pattern: RegExpPattern): CompiledPattern {
  return (scope: Scope) =>
    andThen(scope.stream.step(), (next) => {
      if (!next) {
        return fail(scope, pattern);
      }
      const end = scope.withInput(next);
      const value = rawOf(next.value);
      if (typeof value !== "string") {
        return error(
          scope,
          pattern,
          MatchErrorCode.Type,
          `expected value to be a string but got ${typeof value}`,
        );
      }

      if (pattern.pattern.test(value)) {
        return ok(scope, end, pattern, next.value);
      } else {
        return fail(scope, pattern);
      }
    });
}
