import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { ITypePattern } from "./pattern.ts";

export function type(pattern: ITypePattern, scope: Scope): Match {
  const { type } = pattern;
  if (!scope.stream.done) {
    const end = scope.stream.next();
    const t = typeof end.value;
    if (t === type) {
      return Match.Ok(scope, scope.withInput(end), end.value);
    }
  }
  return Match.Fail(scope);
}
