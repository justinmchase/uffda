import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { ITypePattern } from "./pattern.ts";

export function type(pattern: ITypePattern, scope: Scope): Match {
  const { type: expectedType } = pattern;
  let actualType = typeof undefined;
  if (!scope.stream.done) {
    const end = scope.stream.next();
    actualType = typeof end.value;
    if (actualType === expectedType) {
      return Match.Ok(scope, scope.withInput(end), end.value, pattern);
    }
  }
  return Match.Fail(scope, pattern);
}
