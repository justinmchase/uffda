import { error, fail, Match, MatchKind, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import { ObjectPattern, Pattern } from "./pattern.ts";
import { MatchErrorCode } from "../../match.ts";

export function object(pattern: ObjectPattern, scope: Scope): Match {
  const { keys = {} } = pattern;
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  if (next.value == null) {
    return error(
      scope,
      pattern,
      MatchErrorCode.NullValue,
      "expected value to be non-null",
    );
  }

  if (typeof next.value !== "object") {
    return error(
      scope,
      pattern,
      MatchErrorCode.Type,
      `expected value to be an object, got ${typeof next.value}`,
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
