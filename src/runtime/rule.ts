import {
  error,
  fail,
  forward,
  lr,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../match.ts";
import { match } from "./match.ts";
import { exec } from "./exec.ts";
import { expressionError } from "./expression_error.ts";
import { canSkipMemo } from "./rule.reentrancy.ts";
import { andThen, attempt, type AwaitableMatch } from "./awaitable.ts";
import type { Match, MatchOrigin, MatchSuccess } from "../match.ts";
import type { Memo } from "../memo.ts";
import type { Rule } from "./modules/mod.ts";
import type { Scope } from "./scope.ts";

/**
 * The rule boundary: every fresh rule body evaluation starts on a new
 * microtask, so the JS call stack only ever holds the patterns of the rule
 * body currently being matched, never the whole chain of rules that led to
 * it. Patterns within a rule body complete synchronously whenever their
 * inputs allow (see `awaitable.ts`), but grammar recursion only happens
 * through rules, so deferring here keeps stack depth independent of how
 * deeply the input nests. See
 * `.agents/specifications/runtime.spec.md#synchronous-completion-and-the-rule-boundary`.
 */
function ruleBody(body: () => AwaitableMatch): Promise<Match> {
  return Promise.resolve().then(body);
}

function finishRuleSuccess(
  rule: Rule,
  patternMatch: MatchSuccess,
  callerScope: Scope,
  origin: MatchOrigin,
): AwaitableMatch {
  const { pattern, expression } = rule;
  const end = callerScope.withInput(patternMatch.scope.stream);
  if (!expression) {
    return forward(
      callerScope,
      end,
      pattern,
      patternMatch,
      [patternMatch],
      origin,
    );
  }
  const succeed = (value: unknown) =>
    ok(callerScope, end, pattern, value, [patternMatch], origin);
  return attempt(
    () => exec(expression, patternMatch),
    succeed,
    (err) => expressionError(callerScope, pattern, err),
  );
}

export function rule(
  rule: Rule,
  args: Map<string, Rule>,
  scope: Scope,
): AwaitableMatch {
  const { module, pattern, name, parameters } = rule;
  const mergedArgs = new Map([...(rule.closureArgs ?? new Map()), ...args]);
  const params = new Set<string>();
  for (const p of parameters) {
    params.add(p.name);
    if (!mergedArgs.has(p.name)) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `parameter ${p.name} not provided for rule ${name}`,
      );
    }
  }
  for (const [arg] of args) {
    if (!params.has(arg)) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `argument ${arg} was not expected for rule ${name}`,
      );
    }
  }

  if (canSkipMemo(rule)) {
    return runUnmemoized(rule, mergedArgs, scope);
  }

  const { path } = scope.stream;
  const { key, memo: hit } = scope.memos.resolve(
    path,
    rule,
    [...mergedArgs.values()],
    scope.recovery,
  );
  if (!hit) {
    const marker = lr(scope, pattern);
    const memo = scope.memos.set(path, key, marker);
    const subScope = scope
      .pushModule(module)
      .pushRule(rule, mergedArgs);
    const originOf = (): MatchOrigin => {
      const origin: MatchOrigin = { rule, args: mergedArgs };
      if (memo.seed) origin.seeded = true;
      if (scope.recovery) origin.recovery = true;
      return origin;
    };
    // Left recursion re-entering some other in-progress entry passes through
    // this one; its outcome depends on that entry's growth, so it is dropped.
    const passThrough = (m: Match) => {
      scope.memos.delete(path, key);
      return m;
    };

    return scope.memos.withFrame(
      path,
      () =>
        andThen(ruleBody(() => match(pattern, subScope)), (m) => {
          switch (m.kind) {
            case MatchKind.LR: {
              if (m !== marker) return passThrough(m);
              return andThen(grow(rule, memo, subScope), (grown) => {
                const origin = originOf();
                switch (grown.kind) {
                  case MatchKind.LR:
                    return passThrough(grown);
                  case MatchKind.Error:
                    memo.match = grown;
                    return grown;
                  case MatchKind.Fail: {
                    const failed = fail(scope, rule.pattern, [grown], origin);
                    memo.match = failed;
                    return failed;
                  }
                  case MatchKind.Ok:
                  case MatchKind.Skip: {
                    // Match the non-LR Ok path: expose only the caller scope plus the
                    // advanced stream so inner growth bindings do not leak outward.
                    // Growth already applied the rule-level projection to every
                    // step, so the stabilized value is final.
                    const finished = forward(
                      scope,
                      scope.withInput(grown.scope.stream),
                      rule.pattern,
                      grown,
                      [grown],
                      origin,
                    );
                    memo.match = finished;
                    return finished;
                  }
                }
                return error(
                  scope,
                  rule.pattern,
                  MatchErrorCode.InternalInvariant,
                  `unexpected match kind ${
                    (grown as { kind?: unknown }).kind
                  } after left-recursion growth`,
                );
              });
            }
            case MatchKind.Error:
              memo.match = m;
              return m;
            case MatchKind.Fail: {
              const failed = fail(scope, rule.pattern, [m], originOf());
              memo.match = failed;
              return failed;
            }
            case MatchKind.Ok:
            case MatchKind.Skip: {
              // Store the post-expression success so Or backtracking that
              // re-enters this rule at the same position observes the
              // projected value.
              return andThen(
                finishRuleSuccess(rule, m, scope, originOf()),
                (finished) => {
                  memo.match = finished;
                  return finished;
                },
              );
            }
          }
          return error(
            scope,
            rule.pattern,
            MatchErrorCode.InternalInvariant,
            `unexpected match kind ${(m as { kind?: unknown }).kind}`,
          );
        }),
      memo,
    );
  } else {
    // An in-progress entry holds its left-recursion marker until growth
    // begins, then its current seed; either is returned as-is.
    const m = hit.match;
    switch (m.kind) {
      case MatchKind.Error:
      case MatchKind.LR:
        return m;
      case MatchKind.Fail:
        return fail(scope, rule.pattern, [m]);
      case MatchKind.Ok:
      case MatchKind.Skip:
        return forward(
          scope,
          scope.withInput(m.scope.stream),
          rule.pattern,
          m,
        );
    }
  }
}

/**
 * Runs a rule proven by {@link canSkipMemo} to never be re-enterable at the
 * same input position, without paying any `Memos.resolve`/`set` bookkeeping
 * (packrat key derivation, entry storage, eviction-order tracking). The
 * `active`-position tracking `withFrame` provides is still honored, so other
 * (memoized) rules' eviction low-water mark stays accurate.
 */
function runUnmemoized(
  rule: Rule,
  mergedArgs: Map<string, Rule>,
  scope: Scope,
): AwaitableMatch {
  return scope.memos.withFrame(scope.stream.path, () => {
    // Proven outside every call cycle, so no left recursion can pass through
    // this frame and it records no seed dependency.
    const subScope = scope
      .pushModule(rule.module)
      .pushRule(rule, mergedArgs);
    const origin: MatchOrigin = { rule, args: mergedArgs };
    if (scope.recovery) origin.recovery = true;

    return andThen(ruleBody(() => match(rule.pattern, subScope)), (m) => {
      switch (m.kind) {
        case MatchKind.LR:
          // canSkipMemo only proves a rule safe when it cannot reach itself
          // through statically-resolved calls, so it should never actually
          // grow left-recursively. Surface loudly if it somehow does.
          return error(
            scope,
            rule.pattern,
            MatchErrorCode.InternalInvariant,
            `rule ${rule.name} was proven non-recursive but produced left recursion`,
          );
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(scope, rule.pattern, [m], origin);
        case MatchKind.Ok:
        case MatchKind.Skip:
          return finishRuleSuccess(rule, m, scope, origin);
      }
    });
  });
}

/**
 * Applies the rule-level expression to one growth step, so the seed a
 * re-entry observes is the same value `(P -> E)` would produce.
 */
function projectStep(
  rule: Rule,
  step: MatchSuccess,
  scope: Scope,
): AwaitableMatch {
  const { pattern, expression } = rule;
  if (!expression) return step;
  return attempt(
    () => exec(expression, step),
    (value) => ok(scope, step.scope, pattern, value, [step]),
    (err) => expressionError(scope, pattern, err),
  );
}

/**
 * Iterates `memo`'s left-recursive fixed point: each iteration re-evaluates
 * the rule's pattern with the previous iteration's projected result as the
 * seed, until an iteration fails to consume further. Advancing
 * `memo.iteration` retires every entry computed against the previous seed
 * (see `Memos.resolve`).
 */
async function grow(
  rule: Rule,
  memo: Memo,
  scope: Scope,
): Promise<Match> {
  const { pattern } = rule;
  let growing = true;
  // The initial seed: what re-entering the head reads before any iteration
  // has succeeded. It records no attempt at the input.
  let m: Match = fail(scope, pattern, [], {
    rule,
    args: scope.args,
    seeded: true,
  });
  const start = scope.stream;

  while (growing) {
    memo.match = m;
    memo.iteration++;
    const growScope = scope.withInput(start);

    const result = await match(pattern, growScope);
    const progressed =
      result.scope.stream.path.compareTo(m.scope.stream.path) > 0;
    switch (result.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return result;
      case MatchKind.Fail:
        // With no successful seed yet, this is the head's only real attempt;
        // its rejected sub-matches stay reachable for diagnostics and tooling.
        if (m.kind === MatchKind.Fail) m = result;
        growing = false;
        break;
      case MatchKind.Ok:
      case MatchKind.Skip:
        if (!progressed) {
          growing = false;
        } else {
          const projected = await projectStep(rule, result, growScope);
          if (projected.kind === MatchKind.Error) return projected;
          m = projected;
        }
        break;
    }
  }

  switch (m.kind) {
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
    case MatchKind.Skip:
      return forward(scope, m.scope, pattern, m);
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InternalInvariant,
    `unexpected match kind ${(m as { kind?: unknown }).kind} after grow`,
  );
}
