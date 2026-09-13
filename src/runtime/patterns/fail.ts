import { fail as matchFail } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { FailPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `Fail` pattern into a flattened, reusable closure. */
export function fail(pattern: FailPattern): CompiledPattern {
  return (scope: Scope) => Promise.resolve(matchFail(scope, pattern));
}
