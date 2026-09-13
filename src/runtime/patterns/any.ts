import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { AnyPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Any` pattern into a flattened, reusable closure. */
export function any(pattern: AnyPattern): CompiledPattern {
  return async (scope: Scope) => {
    if (await scope.stream.done()) {
      return fail(scope, pattern);
    }
    const next = await scope.stream.next();
    const end = scope.withInput(next);
    return ok(scope, end, pattern, next.value);
  };
}
