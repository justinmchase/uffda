import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import type { Scope } from "../scope.ts";
import { match } from "../match.ts";
import type { VariablePattern } from "./pattern.ts";

export async function variable(
  pattern: VariablePattern,
  scope: Scope,
): Promise<Match> {
  const { name } = pattern;
  if (scope.variables.has(name)) {
    return error(
      scope,
      pattern,
      MatchErrorCode.DuplicateVariable,
      `Variable ${name} already exists in scope`,
    );
  }

  const m = await match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(
        scope,
        m.scope.addVariables({ [name]: m.value }),
        pattern,
        m.value,
        [m],
      );
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InvalidArgument,
    `unexpected match kind ${
      (m as { kind?: unknown }).kind
    } in variable child pattern`,
  );
}
