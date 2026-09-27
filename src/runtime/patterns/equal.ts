import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { EqualPattern } from "./pattern.ts";
import { resolveValueSource } from "./value_source.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Equal` pattern into a flattened, reusable closure. */
export function equal(pattern: EqualPattern): CompiledPattern {
  return (scope: Scope) => {
    const resolved = resolveValueSource(pattern.value, scope, pattern);
    if (resolved.kind === "error") {
      return resolved.match;
    }
    const value = resolved.value;

    return andThen(scope.stream.step(), (next) => {
      if (!next || next.value !== value) {
        return fail(scope, pattern);
      }
      return ok(scope, scope.withInput(next), pattern, next.value);
    });
  };
}
