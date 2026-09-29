import {
  error,
  fail,
  forward,
  type Match,
  MatchErrorCode,
  type MatchFail,
  MatchKind,
} from "../../match.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { RecoverPattern } from "./pattern.ts";
import { andThen, type AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles a `Recover` pattern into a flattened, reusable closure. */
export function recover(
  pattern: RecoverPattern,
  scope: Scope,
): CompiledPattern {
  const child = compile(pattern.pattern, scope);
  const skip = compile(pattern.skip, scope);

  const unexpected = (invocationScope: Scope, m: Match, role: string) =>
    error(
      invocationScope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `unexpected match kind ${
        (m as { kind?: unknown }).kind
      } in recover ${role} pattern`,
    );

  const recoverFrom = (
    invocationScope: Scope,
    failure: MatchFail,
  ): AwaitableMatch =>
    andThen(skip(invocationScope.withRecovery(false)), (s) => {
      switch (s.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return s;
        case MatchKind.Fail:
          return fail(invocationScope, pattern, [failure, s]);
        case MatchKind.Ok:
        case MatchKind.Skip: {
          if (s.scope.stream.path.compareTo(invocationScope.stream.path) <= 0) {
            return fail(invocationScope, pattern, [failure, s]);
          }
          const recovered = forward(
            invocationScope,
            s.scope.withRecovery(true),
            pattern,
            s,
            [failure, s],
          );
          recovered.recovered = true;
          return recovered;
        }
      }
      return unexpected(invocationScope, s, "skip");
    });

  const discover = (invocationScope: Scope): AwaitableMatch =>
    andThen(child(invocationScope), (m) => {
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Ok:
        case MatchKind.Skip:
          return forward(invocationScope, m.scope, pattern, m);
        case MatchKind.Fail:
          invocationScope.memos.recoverable = true;
          return fail(invocationScope, pattern, [m]);
      }
      return unexpected(invocationScope, m, "child");
    });

  return (invocationScope: Scope) => {
    if (!invocationScope.recovery) return discover(invocationScope);
    const { memos } = invocationScope;
    const depth = memos.depth;
    const outer = memos.watchFailedSeeds();
    return andThen(child(invocationScope), (m) => {
      const seedCaused = memos.endFailedSeedWatch(outer, depth);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Ok:
        case MatchKind.Skip:
          return forward(invocationScope, m.scope, pattern, m);
        case MatchKind.Fail:
          // A failure caused by an enclosing growth's still-failing seed is a
          // control signal of left recursion, not a syntax error.
          return seedCaused
            ? fail(invocationScope, pattern, [m])
            : recoverFrom(invocationScope, m);
      }
      return unexpected(invocationScope, m, "child");
    });
  };
}
