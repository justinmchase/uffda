import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { IOrPattern } from "./pattern.ts";

export function or(args: IOrPattern, scope: Scope) {
  const { patterns } = args;
  const matches: Match[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, scope);
    matches.push(m);
    if (m.isLr) {
      return m;
    }
    if (m.matched) {
      return Match.Ok(scope, m.end, m.value, args, matches);
    }
  }
  return Match.Fail(scope, args, matches);
}
