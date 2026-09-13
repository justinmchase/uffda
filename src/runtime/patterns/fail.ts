import { fail as matchFail } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { FailPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches a `Fail` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildFail}, so there is a single implementation. */
export function fail(pattern: FailPattern, scope: Scope): Match {
  return matchFail(scope, pattern);
}

/** Compiles a `Fail` pattern into a flattened, reusable closure. */
export function buildFail(pattern: FailPattern): CompiledPattern {
  return (scope: Scope) => Promise.resolve(matchFail(scope, pattern));
}
