import { Scope } from "../scope.ts";
import {
  error,
  fail,
  Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { ReferencePattern } from "./pattern.ts";
import { rule } from "../rule.ts";

export function reference(pattern: ReferencePattern, scope: Scope): Match {
  const { name } = pattern;
  const ref = scope.getRule(name);
  if (!ref) {
    return error(
      scope,
      pattern,
      MatchErrorCode.UnknownReference,
      `unknown reference: ${name}`,
    );
  }

  const m = rule(ref, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Ok:
      return ok(scope, m.scope, pattern, m.value, [m]);
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
  }
}
