import { ok as matchOk } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OkPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Ok` pattern into a flattened, reusable closure. */
export function ok(pattern: OkPattern): CompiledPattern {
  return (scope: Scope) => Promise.resolve(matchOk(scope, scope, pattern));
}
