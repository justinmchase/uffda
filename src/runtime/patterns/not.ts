import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import type { NotPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `Not` pattern into a flattened, reusable closure. */
export function not(pattern: NotPattern, scope: Scope): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return async (invocationScope: Scope) => {
    const m = await child(invocationScope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Ok:
        return fail(invocationScope, pattern, [m]);
      case MatchKind.Fail:
        return ok(invocationScope, m.scope, pattern, undefined, [m]);
    }

    return error(
      invocationScope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `unexpected match kind ${
        (m as { kind?: unknown }).kind
      } in not child pattern`,
    );
  };
}
