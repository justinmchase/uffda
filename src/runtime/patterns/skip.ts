import { MatchKind, skip as skipped } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import type { SkipPattern } from "./pattern.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `Skip` pattern into a flattened, reusable closure. */
export function skip(pattern: SkipPattern, scope: Scope): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return (invocationScope: Scope) =>
    andThen(child(invocationScope), (m) => {
      switch (m.kind) {
        case MatchKind.Ok:
        case MatchKind.Skip:
          return skipped(invocationScope, m.scope, pattern, [m]);
        default:
          return m;
      }
    });
}
