import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IOkPattern } from "./pattern.ts";

export function ok(pattern: IOkPattern, scope: Scope) {
  return Match.Ok(scope, scope, undefined, pattern);
}
