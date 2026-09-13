import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { exec } from "../exec.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { ProjectionPattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches a `Projection` pattern: the interpreted entry point delegates
 * to the same logic as {@link buildProjection}, so there is a single
 * implementation. */
export function projection(
  pattern: ProjectionPattern,
  scope: Scope,
): AwaitableMatch {
  return buildProjection(pattern, scope)(scope);
}

/** Compiles a `Projection` pattern into a flattened, reusable closure. */
export function buildProjection(
  pattern: ProjectionPattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return async (invocationScope: Scope) => {
    const m = await child(invocationScope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(invocationScope, pattern, [m]);
      case MatchKind.Ok: {
        try {
          const value = await exec(pattern.expression, m);
          return ok(invocationScope, m.scope, pattern, value, [m]);
        } catch (err) {
          const message = err instanceof Error ? err.message : `${err}`;
          return error(
            invocationScope,
            pattern,
            MatchErrorCode.ExpressionException,
            `expression exception: ${message}`,
            err,
          );
        }
      }
    }
  };
}
