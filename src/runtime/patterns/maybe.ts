import { error, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { MaybePattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches a `Maybe` pattern: the interpreted entry point delegates to
 * the same logic as {@link buildMaybe}, so there is a single
 * implementation. */
export function maybe(pattern: MaybePattern, scope: Scope): AwaitableMatch {
  return buildMaybe(pattern, scope)(scope);
}

/** Compiles a `Maybe` pattern into a flattened, reusable closure. */
export function buildMaybe(
  pattern: MaybePattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return async (invocationScope: Scope) => {
    const m = await child(invocationScope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Ok:
        return ok(
          invocationScope,
          m.scope,
          pattern,
          m.value,
          [m],
        );
      case MatchKind.Fail:
        return ok(
          invocationScope,
          invocationScope,
          pattern,
          undefined,
          [m],
        );
    }

    return error(
      invocationScope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `unexpected match kind ${
        (m as { kind?: unknown }).kind
      } in maybe child pattern`,
    );
  };
}
