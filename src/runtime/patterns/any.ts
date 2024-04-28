import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IAnyPattern } from "./pattern.ts";

export function any(pattern: IAnyPattern, scope: Scope): Match {
  if (!scope.stream.done) {
    const end = scope.stream.next();
    return Match.Ok(scope, scope.withInput(end), end.value, pattern);
  } else {
    return Match.Fail(scope, pattern);
  }
}
