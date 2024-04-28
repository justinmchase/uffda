import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { IThenPattern } from "./pattern.ts";

export function then(args: IThenPattern, scope: Scope): Match {
  const { patterns } = args;
  let end = scope;
  const matches: Match[] = [];
  const values: unknown[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, end);
    matches.push(m);

    if (m.isLr) {
      return m;
    }

    if (!m.matched) {
      return Match.Fail(scope, args, matches);
    }

    end = m.end;
    values.push(m.value);
  }

  return Match.Ok(scope, end, values, args, matches);
}
