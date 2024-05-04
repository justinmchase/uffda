import { Scope } from "../scope.ts";
import {
  error,
  fail,
  Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { ISpecialPattern } from "./pattern.ts";
import { run } from "./run.ts";
import { ModuleKind } from "../modules/mod.ts";
import { rule } from "../rule.ts";
import { PatternKind } from "./pattern.kind.ts";

export function special(pattern: ISpecialPattern, scope: Scope): Match {
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
      case ModuleKind.Module:
        return run(scope.pushModule(value), { kind: PatternKind.Run });
      case ModuleKind.Rule:
        return rule(value, scope);
      // todo: Theoretically we could support any pattern object being inlined directly if we wanted.
      default:
        return error(
          scope,
          pattern,
          MatchErrorCode.UnknownReference,
          `Unknown special pattern kind ${value.kind}`,
        );
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
