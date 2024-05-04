import {
  error,
  fail,
  Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { VariablePattern } from "./pattern.ts";

export function variable(pattern: VariablePattern, scope: Scope): Match {
  const { name } = pattern;
  if (scope.variables.has(name)) {
    return error(
      scope,
      pattern,
      MatchErrorCode.DuplicateVariable,
      `Variable ${name} already exists in scope`,
    );
  }

  const m = match(pattern.pattern, scope);
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
}
