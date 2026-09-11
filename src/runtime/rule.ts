import { error, fail, lr, MatchErrorCode, MatchKind, ok } from "../match.ts";
import { match } from "./match.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";
import { exec } from "./exec.ts";
import type { AwaitableMatch } from "./awaitable.ts";
import type { Match, MatchOk } from "../match.ts";
import type { Rule } from "./modules/mod.ts";
import type { Scope } from "./scope.ts";
import type { Pattern } from "./patterns/pattern.ts";

async function finishRuleSuccess(
  rule: Rule,
  patternMatch: MatchOk,
  callerScope: Scope,
): AwaitableMatch {
  const { pattern, expression } = rule;
  let value: unknown;
  try {
    value = expression
      ? await exec(expression, patternMatch)
      : patternMatch.value;
  } catch (err) {
    const message = err instanceof Error ? err.message : `${err}`;
    return error(
      callerScope,
      pattern,
      MatchErrorCode.ExpressionException,
      `expression exception: ${message}`,
      err,
    );
  }
  return ok(
    callerScope,
    callerScope.withInput(patternMatch.scope.stream),
    pattern,
    value,
    [patternMatch],
  );
}

export async function rule(
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

  let { key, memo } = scope.memos.resolve(scope.stream.path, rule, [
    ...mergedArgs.values(),
  ]);
  if (!memo) {
    return await scope.memos.withFrame(scope.stream.path, async () => {
      memo = scope.memos.set(scope.stream.path, key, lr(scope, pattern));
      const subScope = scope
        .pushModule(module)
        .pushRule(rule, mergedArgs);

      const m = await match(pattern, subScope);
      switch (m.kind) {
        case MatchKind.LR: {
          const grown = await grow(pattern, key, subScope);
          switch (grown.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              memo!.match = grown;
              return grown;
            case MatchKind.Fail: {
              const failed = fail(scope, rule.pattern, [grown]);
              memo!.match = failed;
              return failed;
            }
            case MatchKind.Ok: {
              // Match the non-LR Ok path: expose only the caller scope plus the
              // advanced stream so inner growth bindings do not leak outward.
              // Apply rule-level projection to the stabilized growth result, then
              // memoize that caller-visible value for later non-growth reuse.
              const finished = await finishRuleSuccess(rule, grown, scope);
              memo!.match = finished;
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
        }
        case MatchKind.Error:
          memo!.match = m;
          return m;
        case MatchKind.Fail: {
          const failed = fail(scope, rule.pattern, [m]);
          memo!.match = failed;
          return failed;
        }
        case MatchKind.Ok: {
          const finished = await finishRuleSuccess(rule, m, scope);
          // Store the post-expression success so Or backtracking that
          // re-enters this rule at the same position observes the
          // projected value.
          memo!.match = finished;
          return finished;
        }
      }
      return error(
        scope,
        rule.pattern,
        MatchErrorCode.InternalInvariant,
        `unexpected match kind ${(m as { kind?: unknown }).kind}`,
      );
    });
  } else {
    const m = memo.match;
    const frame = scope.stack[scope.stack.length - 1];
    switch (m.kind) {
      case MatchKind.Error:
        return m;
      case MatchKind.LR:
        if (frame?.kind !== StackFrameKind.Rule) {
          return error(
            scope,
            rule.pattern,
            MatchErrorCode.IndirectLeftRecursion,
            `Unexpected stack frame kind ${frame.kind}`,
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

async function grow(
  pattern: Pattern,
  key: symbol,
  scope: Scope,
): AwaitableMatch {
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
