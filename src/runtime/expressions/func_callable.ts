import { MatchKind, type MatchOk } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import type { Func } from "../modules/func.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import type { Pattern } from "../patterns/pattern.ts";

export type FuncCallable = (...args: unknown[]) => Promise<unknown>;

/** Require full consumption of the args stream after the declared pattern. */
function argsPattern(pattern: Pattern): Pattern {
  if (pattern.kind === PatternKind.End) {
    return pattern;
  }
  return {
    kind: PatternKind.Then,
    patterns: [pattern, { kind: PatternKind.End }],
  };
}

/**
 * Wrap a module func as an ordinary callable. Arguments are matched as an
 * iterable stream against the func pattern (Patterns-as-types); on success the
 * body runs via `exec` with bound variables.
 */
export function funcCallable(fn: Func, matchOk: MatchOk): FuncCallable {
  return async (...args: unknown[]) => {
    const pattern = argsPattern(fn.pattern);
    const stream = new Input(
      args,
      matchOk.scope.stream.path.push(0),
      0,
      undefined,
      InputNormalizationMode.Iterable,
    );
    const scope = matchOk.scope.withInput(stream);
    const result = await match(pattern, scope);
    switch (result.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return result;
      case MatchKind.Fail:
        throw new Error(
          `func ${fn.name}: arguments did not match parameter pattern`,
        );
      case MatchKind.Ok:
        return await exec(fn.expression, result);
    }
  };
}
