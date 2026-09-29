import {
  error,
  fail,
  forward,
  MatchErrorCode,
  MatchKind,
} from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { VariablePattern } from "./pattern.ts";

/** Compiles a `Variable` pattern into a flattened, reusable closure. */
export function variable(
  pattern: VariablePattern,
  scope: Scope,
): CompiledPattern {
  const { name } = pattern;
  const child = compile(pattern.pattern, scope);
  return (invocationScope: Scope) => {
    if (invocationScope.variables.has(name)) {
      return error(
        invocationScope,
        pattern,
        MatchErrorCode.DuplicateVariable,
        `Variable ${name} already exists in scope`,
      );
    }
    return andThen(child(invocationScope), (m) => {
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(invocationScope, pattern, [m]);
        case MatchKind.Ok:
        case MatchKind.Skip:
          return forward(
            invocationScope,
            m.scope.addVariable(name, m.value),
            pattern,
            m,
          );
      }
      return error(
        invocationScope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `unexpected match kind ${
          (m as { kind?: unknown }).kind
        } in variable child pattern`,
      );
    });
  };
}
