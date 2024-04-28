import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IFailPattern } from "./pattern.ts";

export function fail(pattern: IFailPattern, scope: Scope): Match {
  return Match.Fail(scope, pattern);
}
