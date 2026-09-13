import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile, match } from "../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { VariablePattern } from "./pattern.ts";

export async function variable(
  pattern: VariablePattern,
  scope: Scope,
): Promise<Match> {
  const { name } = pattern;
  if (scope.variables.has(name)) {
    return error(
      scope,
      pattern,
      MatchErrorCode.DuplicateVariable,
      `Variable ${name} already exists in scope`,
    );
  }

  const m = await match(pattern.pattern, scope);
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
