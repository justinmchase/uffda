import { Match, MatchError } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { IThenPattern } from "./pattern.ts";

export function then(args: IThenPattern, scope: Scope): Match {
  const { patterns } = args;
  let end = scope;
  const values: unknown[] = [];
  const errors: MatchError[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, end);
    errors.push(...m.errors);

    if (!m.matched) {
      return m.setErrors(errors);
    }

    end = m.end;
    values.push(m.value);
  }

  return Match.Ok(scope, end, values, errors);
}
