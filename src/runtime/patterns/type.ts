import { type as typeCheck } from "@justinmchase/type";
import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { TypePattern } from "./pattern.ts";

/** Compiles a `Type` pattern into a flattened, reusable closure. */
export function type(pattern: TypePattern): CompiledPattern {
  const { type: expectedType } = pattern;
  return (scope: Scope) =>
    andThen(scope.stream.step(), (next) => {
      if (!next) {
        return fail(scope, pattern);
      }
      const [actualType] = typeCheck(next.value);
      if (actualType === expectedType) {
        return ok(scope, scope.withInput(next), pattern, next.value);
      }
      return fail(scope, pattern);
    });
}
