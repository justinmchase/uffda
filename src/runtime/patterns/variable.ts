import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { VariablePattern } from "./pattern.ts";

/** Matches a `Variable` pattern: the interpreted entry point delegates to
 * the same logic as {@link buildVariable}, so there is a single
 * implementation. */
export function variable(
  pattern: VariablePattern,
  scope: Scope,
): AwaitableMatch {
  return buildVariable(pattern)(scope);
}

/** Compiles a `Variable` pattern into a flattened, reusable closure. */
export function buildVariable(pattern: VariablePattern): CompiledPattern {
  const { name } = pattern;
  const child = compile(pattern.pattern);
  return async (scope: Scope) => {
    if (scope.variables.has(name)) {
      return error(
        scope,
        pattern,
        MatchErrorCode.DuplicateVariable,
        `Variable ${name} already exists in scope`,
      );
    }
    const m = await child(scope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, pattern, [m]);
      case MatchKind.Ok:
        return ok(
          scope,
          m.scope.addVariables({ [name]: m.value }),
          pattern,
          m.value,
          [m],
        );
    }
    return error(
      scope,
      pattern,
      MatchErrorCode.InvalidArgument,
      `unexpected match kind ${
        (m as { kind?: unknown }).kind
      } in variable child pattern`,
    );
  };
}
