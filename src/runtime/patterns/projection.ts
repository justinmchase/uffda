import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { ProjectionPattern } from "./pattern.ts";

export async function projection(
  pattern: ProjectionPattern,
  scope: Scope,
): Promise<Match> {
  const m = await match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok: {
      try {
        const value = await exec(pattern.expression, m);
        return ok(scope, m.scope, pattern, value, [m]);
      } catch (err) {
        const message = err instanceof Error ? err.message : `${err}`;
        return error(
          scope,
          pattern,
          MatchErrorCode.ExpressionException,
          `expression exception: ${message}`,
          err,
        );
      }
    }
  }
}
