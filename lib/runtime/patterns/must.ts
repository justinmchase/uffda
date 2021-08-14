import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { match } from "../match.ts";
import { IMustPattern } from "./pattern.ts";

export function must(args: IMustPattern, scope: Scope): Match {
  const { pattern } = args;
  const m = match(pattern, scope);
  if (m.matched) {
    return m;
  }

  return Match
    .Fail(scope)
    .pushError(scope, scope);
}
