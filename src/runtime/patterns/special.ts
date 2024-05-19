import { Scope } from "../scope.ts";
import {
  error,
  fail,
  Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { SpecialPattern } from "./pattern.ts";
import { run } from "./run.ts";
import { rule } from "../rule.ts";
import { PatternKind } from "./pattern.kind.ts";
import { SpecialKind } from "../modules/special.ts";

export function special(pattern: SpecialPattern, scope: Scope): Match {
  const { value } = pattern;
  if (value == null) {
    return error(
      scope,
      pattern,
      MatchErrorCode.NullValue,
      `Special patterns require a value`,
    );
  }

  if (typeof value === "function") {
    // todo: Theoretically we could support this with a native pattern, where they pass in a function as a pattern which does custom handling.
    return error(
      scope,
      pattern,
      MatchErrorCode.Type,
      `Function patterns are not supported yet`,
    );
  }

  const m = (() => {
    switch (value.kind) {
      case SpecialKind.Module:
        return run(scope.pushModule(value.module), { kind: PatternKind.Run });
      case SpecialKind.Rule:
        return rule(value.rule, new Map(), scope);
    }
  })();

  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, m.scope.pop(scope), pattern, m.value, [m]);
  }
}
