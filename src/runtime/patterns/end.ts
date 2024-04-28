import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IEndPattern } from "./pattern.ts";

export function end(pattern: IEndPattern, scope: Scope) {
  if (scope.stream.done) {
    return Match.Ok(scope, scope, undefined, pattern);
  } else {
    return Match.Fail(scope, pattern);
  }
}
