import { MatchKind, type MatchOk } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import { andThen, type Awaitable } from "../awaitable.ts";
import type { Func } from "../modules/func.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import type { Pattern } from "../patterns/pattern.ts";

export type FuncCallable = (...args: unknown[]) => Awaitable<unknown>;

const argsPatterns = new WeakMap<Pattern, Pattern>();

/**
 * Require full consumption of the args stream after the declared pattern.
 * The same derived pattern object is returned for a given `pattern`, so the
 * resolver's per-pattern compile cache (keyed by identity) compiles it once
 * rather than on every call.
 */
export function argsPattern(pattern: Pattern): Pattern {
  if (pattern.kind === PatternKind.End) {
    return pattern;
  }
  let derived = argsPatterns.get(pattern);
  if (!derived) {
    derived = {
      kind: PatternKind.Then,
      patterns: [pattern, { kind: PatternKind.End }],
    };
    argsPatterns.set(pattern, derived);
  }
  return derived;
}

/**
 * Wrap a module func as an ordinary callable. Arguments are matched as an
 * iterable stream against the func pattern (Patterns-as-types); on success the
 * body runs via `exec` with bound variables.
 *
 * `subject`, when provided, rebinds `this` inside the func body (see
 * `reference()`) to `subject` instead of the args-match. Used only for
 * decorator invocation, where `this` must resolve to the `Rule`/`Func` being
 * decorated; see `.agents/specifications/runtime/rule-metadata.spec.md`.
 */
export function funcCallable(
  fn: Func,
  matchOk: MatchOk,
  subject?: unknown,
): FuncCallable {
  return (...args: unknown[]) => {
    const pattern = argsPattern(fn.pattern);
    const stream = new Input(
      args,
      matchOk.scope.stream.path.push(0),
      0,
      undefined,
      InputNormalizationMode.Iterable,
    );
    const scope = matchOk.scope.withInput(stream);
    return andThen(match(pattern, scope), (result) => {
      switch (result.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return result;
        case MatchKind.Fail:
          throw new Error(
            `func ${fn.name}: arguments did not match parameter pattern`,
          );
        case MatchKind.Ok:
          return exec(
            fn.expression,
            subject === undefined ? result : { ...result, subject },
          );
      }
    });
  };
}
