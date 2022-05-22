import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";

export function end(scope: Scope) {
  if (scope.stream.done) {
    return Match.Default(scope);
  } else {
    return Match.Fail(scope);
  }
}
