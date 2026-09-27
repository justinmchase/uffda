import { error, fail, lr, MatchErrorCode, MatchKind, ok } from "../match.ts";
import { match } from "./match.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";
import { exec } from "./exec.ts";
import { expressionError } from "./expression_error.ts";
import { canSkipMemo } from "./rule.reentrancy.ts";
import { andThen, attempt, type AwaitableMatch } from "./awaitable.ts";
import type { Match, MatchOk, MatchOrigin } from "../match.ts";
import type { Rule } from "./modules/mod.ts";
import type { Scope } from "./scope.ts";
import type { Pattern } from "./patterns/pattern.ts";

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
  patternMatch: MatchOk,
  callerScope: Scope,
  origin: MatchOrigin,
): AwaitableMatch {
  const { pattern, expression } = rule;
  const succeed = (value: unknown) =>
    ok(
      callerScope,
      callerScope.withInput(patternMatch.scope.stream),
      pattern,
      value,
      [patternMatch],
      origin,
    );
  if (!expression) {
    return succeed(patternMatch.value);
  }
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

  let { key, memo } = scope.memos.resolve(scope.stream.path, rule, [
    ...mergedArgs.values(),
  ]);
  if (!memo) {
    return scope.memos.withFrame(scope.stream.path, () => {
      memo = scope.memos.set(scope.stream.path, key, lr(scope, pattern));
      const subScope = scope
        .pushModule(module)
        .pushRule(rule, mergedArgs);
      const origin: MatchOrigin = { rule, args: mergedArgs };

      return andThen(ruleBody(() => match(pattern, subScope)), (m) => {
        switch (m.kind) {
          case MatchKind.LR: {
            return andThen(grow(pattern, key, subScope), (grown) => {
              switch (grown.kind) {
                case MatchKind.LR:
                case MatchKind.Error:
                  memo!.match = grown;
                  return grown;
                case MatchKind.Fail: {
                  const failed = fail(scope, rule.pattern, [grown], origin);
                  memo!.match = failed;
                  return failed;
                }
                case MatchKind.Ok: {
                  // Match the non-LR Ok path: expose only the caller scope plus the
                  // advanced stream so inner growth bindings do not leak outward.
                  // Apply rule-level projection to the stabilized growth result, then
                  // memoize that caller-visible value for later non-growth reuse.
                  return andThen(
                    finishRuleSuccess(rule, grown, scope, origin),
                    (finished) => {
                      memo!.match = finished;
                      return finished;
                    },
                  );
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
            memo!.match = m;
            return m;
          case MatchKind.Fail: {
            const failed = fail(scope, rule.pattern, [m], origin);
            memo!.match = failed;
            return failed;
          }
          case MatchKind.Ok: {
            // Store the post-expression success so Or backtracking that
            // re-enters this rule at the same position observes the
            // projected value.
            return andThen(
              finishRuleSuccess(rule, m, scope, origin),
              (finished) => {
                memo!.match = finished;
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
      });
    });
  } else {
    const m = memo.match;
    const frame = scope.stack.top;
    switch (m.kind) {
      case MatchKind.Error:
        return m;
      case MatchKind.LR:
        if (frame?.kind !== StackFrameKind.Rule) {
          return error(
            scope,
            rule.pattern,
            MatchErrorCode.IndirectLeftRecursion,
            `Unexpected stack frame kind ${frame?.kind}`,
          );
        } else if (!Object.is(frame.rule, rule)) {
          // This is a different rule than the one we're trying to match
          // Therefore ILR is detected and we should fail
          // todo: should this be an error instead?
          return fail(scope, rule.pattern);
        } else {
          // Otherwise end the LR and continue
          return m;
        }
      case MatchKind.Fail:
        return fail(scope, rule.pattern, [m]);
      case MatchKind.Ok:
        return ok(
          scope,
          scope.withInput(m.scope.stream),
          rule.pattern,
          m.value,
          [m],
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
    const subScope = scope
      .pushModule(rule.module)
      .pushRule(rule, mergedArgs);
    const origin: MatchOrigin = { rule, args: mergedArgs };

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
          return finishRuleSuccess(rule, m, scope, origin);
      }
    });
  });
}

async function grow(
  pattern: Pattern,
  key: symbol,
  scope: Scope,
): Promise<Match> {
  let growing = true;
  let m: Match = fail(scope, pattern);
  const start = scope.stream;
  const { memo } = scope.memos.get(start.path, key);
  if (!memo) {
    return error(
      scope,
      pattern,
      MatchErrorCode.InternalInvariant,
      "left recursion memo missing during grow",
    );
  }

  while (growing) {
    memo.match = m;
    const growScope = scope.withInput(start);

    const result = await match(pattern, growScope);
    const progressed =
      result.scope.stream.path.compareTo(m.scope.stream.path) > 0;
    switch (result.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return result;
      case MatchKind.Fail:
        growing = false;
        break;
      case MatchKind.Ok:
        if (!progressed) {
          growing = false;
        } else {
          m = result;
        }
        break;
    }
  }

  switch (m.kind) {
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, m.scope, pattern, m.value, [m]);
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InternalInvariant,
    `unexpected match kind ${(m as { kind?: unknown }).kind} after grow`,
  );
}
