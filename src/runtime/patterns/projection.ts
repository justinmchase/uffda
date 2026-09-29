import { fail, MatchKind, ok } from "../../match.ts";
import { exec } from "../exec.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { ProjectionPattern } from "./pattern.ts";
import { andThen, attempt } from "../awaitable.ts";
import { expressionError } from "../expression_error.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `Projection` pattern into a flattened, reusable closure. */
export function projection(
  pattern: ProjectionPattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return (invocationScope: Scope) =>
    andThen(child(invocationScope), (m) => {
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(invocationScope, pattern, [m]);
        case MatchKind.Ok:
        case MatchKind.Skip:
          return attempt(
            () => exec(pattern.expression, m),
            (value) => ok(invocationScope, m.scope, pattern, value, [m]),
            (err) => expressionError(invocationScope, pattern, err),
          );
      }
    });
}
