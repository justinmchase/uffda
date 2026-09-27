import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { EndPattern } from "./pattern.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `End` pattern into a flattened, reusable closure. */
export function end(pattern: EndPattern): CompiledPattern {
  return (scope: Scope) =>
    andThen(
      scope.stream.done(),
      (done) => done ? ok(scope, scope, pattern) : fail(scope, pattern),
    );
}
