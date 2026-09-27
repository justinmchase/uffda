import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { AnyPattern } from "./pattern.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Any` pattern into a flattened, reusable closure. */
export function any(pattern: AnyPattern): CompiledPattern {
  return (scope: Scope) =>
    andThen(scope.stream.step(), (next) => {
      if (!next) {
        return fail(scope, pattern);
      }
      return ok(scope, scope.withInput(next), pattern, next.value);
    });
}
