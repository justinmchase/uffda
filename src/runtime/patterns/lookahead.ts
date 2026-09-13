import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { LookaheadPattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches a `Lookahead` pattern: the interpreted entry point delegates
 * to the same logic as {@link buildLookahead}, so there is a single
 * implementation. */
export function lookahead(
  pattern: LookaheadPattern,
  scope: Scope,
): AwaitableMatch {
  return buildLookahead(pattern, scope)(scope);
}

/** Compiles a `Lookahead` pattern into a flattened, reusable closure. */
export function buildLookahead(
  pattern: LookaheadPattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return async (invocationScope: Scope) => {
    const m = await child(invocationScope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(invocationScope, pattern, [m]);
      case MatchKind.Ok:
        return ok(invocationScope, invocationScope, pattern, m.value, [m]);
    }

    return error(
      invocationScope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `unexpected match kind ${
        (m as { kind?: unknown }).kind
      } in lookahead child pattern`,
    );
  };
}
