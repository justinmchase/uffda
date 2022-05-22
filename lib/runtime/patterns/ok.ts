import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";

export function ok(scope: Scope) {
  return Match.Default(scope);
}
