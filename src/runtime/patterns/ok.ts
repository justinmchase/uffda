import { ok as matchOk } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OkPattern } from "./pattern.ts";

export function ok(pattern: OkPattern, scope: Scope): Match {
  return matchOk(scope, scope, pattern);
}
