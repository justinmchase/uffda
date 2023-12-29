import { Match, MatchError } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { IOrPattern } from "./pattern.ts";

export function or(args: IOrPattern, scope: Scope) {
  const { patterns } = args;
  const errors: MatchError[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, scope);
    if (m.matched || m.isLr) {
      return m;
    } else {
      errors.push(...m.errors);
    }
  }
  return Match.Fail(scope).setErrors(errors);
}
