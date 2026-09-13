import { ok as matchOk } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OkPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches an `Ok` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildOk}, so there is a single implementation. */
export function ok(pattern: OkPattern, scope: Scope): Match {
  return matchOk(scope, scope, pattern);
}

/** Compiles an `Ok` pattern into a flattened, reusable closure. */
export function buildOk(pattern: OkPattern): CompiledPattern {
  return (scope: Scope) => Promise.resolve(matchOk(scope, scope, pattern));
}
