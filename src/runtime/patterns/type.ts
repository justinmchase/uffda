import { type as typeCheck } from "@justinmchase/type";
import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { TypePattern } from "./pattern.ts";

/** Matches a `Type` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildType}, so there is a single implementation. */
export function type(pattern: TypePattern, scope: Scope): AwaitableMatch {
  return buildType(pattern)(scope);
}

/** Compiles a `Type` pattern into a flattened, reusable closure. */
export function buildType(pattern: TypePattern): CompiledPattern {
  const { type: expectedType } = pattern;
  return async (scope: Scope) => {
    if (await scope.stream.done()) {
      return fail(scope, pattern);
    }
    const end = await scope.stream.next();
    const [actualType] = typeCheck(end.value);
    if (actualType === expectedType) {
      return ok(scope, scope.withInput(end), pattern, end.value);
    }
    return fail(scope, pattern);
  };
}
