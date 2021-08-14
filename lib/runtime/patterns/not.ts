import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { match } from "../match.ts";
import { INotPattern } from "./pattern.ts";

export function not(args: INotPattern, scope: Scope): Match {
  const { pattern } = args;
  const m = match(pattern, scope);
  if (!m.matched) {
    return Match.Ok(scope, scope, undefined, m.errors);
  }

  return Match.Fail(scope);
}
