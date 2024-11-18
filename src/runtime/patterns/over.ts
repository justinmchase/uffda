import { Type, type } from "@justinmchase/type";
import { error, fail, MatchKind, ok } from "../../match.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import { MatchErrorCode } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OverPattern, Pattern } from "./pattern.ts";

export function over(pattern: OverPattern, scope: Scope): Match {
  const { keys = {} } = pattern;
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  const [t] = type(next.value);

  // todo: handle maps as well...
  if (t !== Type.Object) {
    return error(
      scope,
      pattern,
      MatchErrorCode.Type,
      `expected value to be an object but got type ${t}`,
    );
  }

  let last = scope;
  const matches: Match[] = [];
  const objValue = next.value as Record<PropertyKey, unknown>;
  for (const [key, pattern] of Object.entries<Pattern>(keys)) {
    // The pattern will define whether or not its an error for this field to exist or not
    const keyValue = objValue[key];
    const value = [keyValue];
    const propertyStream = new Input(
      value,
      next.path.push(key),
    );
    const propertyScope = last.withInput(propertyStream);
    const m = match(pattern, propertyScope);
    matches.push(m);

    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, pattern, matches);
      case MatchKind.Ok:
        last = m.scope;
        break;
    }
  }

  return ok(
    scope,
    scope.withInput(next).addVariables(last.variables),
    pattern,
    next.value,
    matches,
  );
}
