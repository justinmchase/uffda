import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";

export function fail(scope: Scope): Match {
  return Match.Fail(scope);
}
