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
import { Rule } from "../modules/rule.ts";

export function reference(pattern: ReferencePattern, scope: Scope): Match {
  const ref = scope.getRule(pattern.name);
  if (!ref) {
    return error(
      scope,
      pattern,
      MatchErrorCode.UnknownReference,
      `unknown reference: ${pattern.name}`,
    );
  }

  if (pattern.args.length !== ref.parameters.length) {
    return error(
      scope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `invalid argument count: expected ${ref.parameters.length}, got ${pattern.args.length}`,
    );
  }

  const args = new Map<string, Rule>();
  for (let i = 0; i < pattern.args.length; i++) {
    const argName = pattern.args[i];
    const paramName = ref.parameters[i].name;
    const r = scope.getRule(argName);
    if (!r) {
      return error(
        scope,
        pattern,
        MatchErrorCode.UnknownParameter,
        `unknown argument reference: ${argName}`,
      );
    } else if (r === ref) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `invalid self reference: ${argName}`,
      );
    } else {
      args.set(paramName, r);
    }
  }

  const m = rule(ref, args, scope);
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
