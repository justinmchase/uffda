import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { EndPattern } from "./pattern.ts";

export function end(pattern: EndPattern, scope: Scope): Match {
  if (scope.stream.done) {
    return ok(scope, scope, pattern);
  } else {
    return fail(scope, pattern);
  }
}
