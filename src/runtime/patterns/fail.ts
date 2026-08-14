import { fail as matchFail } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { FailPattern } from "./pattern.ts";

export function fail(pattern: FailPattern, scope: Scope): Match {
  return matchFail(scope, pattern);
}
