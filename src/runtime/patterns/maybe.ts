import { error, forward, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { MaybePattern } from "./pattern.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `Maybe` pattern into a flattened, reusable closure. */
export function maybe(
  pattern: MaybePattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  return (invocationScope: Scope) =>
    andThen(child(invocationScope), (m) => {
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Ok:
        case MatchKind.Skip:
          return forward(invocationScope, m.scope, pattern, m);
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
    });
}
