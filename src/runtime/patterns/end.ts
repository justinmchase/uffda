import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IEndPattern } from "./pattern.ts";

export function end(pattern: IEndPattern, scope: Scope): Match {
  if (scope.stream.done) {
    return ok(scope, scope, pattern);
  } else {
    return fail(scope, pattern);
  }
}
