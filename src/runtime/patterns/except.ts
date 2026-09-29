import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { ExceptPattern } from "./pattern.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Except` pattern into a flattened, reusable closure. */
export function except(
  pattern: ExceptPattern,
  scope: Scope,
): CompiledPattern {
  const assertionChild = compile(pattern.pattern, scope);
  return (invocationScope: Scope) =>
    andThen(invocationScope.stream.step(), (next) => {
      if (!next) {
        return fail(invocationScope, pattern);
      }
      return andThen(
        assertionChild(invocationScope.withRecovery(false)),
        (assertion) => {
          switch (assertion.kind) {
            case MatchKind.LR:
              return assertion;
            case MatchKind.Error:
              return assertion;
            case MatchKind.Ok:
            case MatchKind.Skip:
              return fail(invocationScope, pattern, [assertion]);
            case MatchKind.Fail: {
              const end = invocationScope.withInput(next);
              return ok(invocationScope, end, pattern, next.value, [assertion]);
            }
          }

          return error(
            invocationScope,
            pattern,
            MatchErrorCode.InvalidArgument,
            `unexpected match kind ${
              (assertion as { kind?: unknown }).kind
            } in except assertion`,
          );
        },
      );
    });
}
