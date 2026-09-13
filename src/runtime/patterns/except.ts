import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { compile } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { ExceptPattern } from "./pattern.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches an `Except` pattern: the interpreted entry point delegates to
 * the same logic as {@link buildExcept}, so there is a single
 * implementation. */
export function except(pattern: ExceptPattern, scope: Scope): AwaitableMatch {
  return buildExcept(pattern, scope)(scope);
}

/** Compiles an `Except` pattern into a flattened, reusable closure. */
export function buildExcept(
  pattern: ExceptPattern,
  scope: Scope,
): CompiledPattern {
  const assertionChild = compile(pattern.pattern, scope);
  return async (invocationScope: Scope) => {
    if (await invocationScope.stream.done()) {
      return fail(invocationScope, pattern);
    }

    const assertion = await assertionChild(invocationScope);
    switch (assertion.kind) {
      case MatchKind.LR:
        return assertion;
      case MatchKind.Error:
        return assertion;
      case MatchKind.Ok:
        return fail(invocationScope, pattern, [assertion]);
      case MatchKind.Fail: {
        const next = await invocationScope.stream.next();
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
  };
}
