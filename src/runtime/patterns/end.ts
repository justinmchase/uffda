import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { EndPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `End` pattern into a flattened, reusable closure. */
export function end(pattern: EndPattern): CompiledPattern {
  return async (scope: Scope) => {
    if (await scope.stream.done()) {
      return ok(scope, scope, pattern);
    } else {
      return fail(scope, pattern);
    }
  };
}
