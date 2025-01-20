import { error, fail, lr, MatchErrorCode, MatchKind, ok } from "../match.ts";
import { match } from "./match.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";
import { exec } from "./exec.ts";
import type { Match } from "../match.ts";
import type { Rule } from "./modules/mod.ts";
import type { Scope } from "./scope.ts";
import type { Pattern } from "./patterns/pattern.ts";

export function rule(
  rule: Rule,
  args: Map<string, Rule>,
  scope: Scope,
): Match {
  const { module, pattern, expression, name, parameters } = rule;
  const params = new Set<string>();
  for (const p of parameters) {
    params.add(p.name);
    if (!args.has(p.name)) {
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
    ...args.values(),
  ]);
  if (!memo) {
    memo = scope.memos.set(scope.stream.path, key, lr(scope, pattern));
    const subScope = scope
      .pushModule(module)
      .pushRule(rule, args);

    const m = match(pattern, subScope);
    memo.match = m;
    switch (m.kind) {
      case MatchKind.LR:
        return grow(pattern, key, subScope);
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, rule.pattern, [m]);
      case MatchKind.Ok: {
        const value = expression ? exec(expression, m) : m.value;
        return ok(
          scope,
          scope.withInput(m.scope.stream),
          rule.pattern,
          value,
          [m],
        );
      }
    }
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
          // return ok(scope, scope.withInput(m.scope.stream), rule.pattern, undefined, [memo.match])
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

function grow(pattern: Pattern, key: symbol, scope: Scope): Match {
  let growing = true;
  let m: Match = fail(scope, pattern);
  const start = scope.stream;
  const { memo } = scope.memos.get(start.path, key);
  if (!memo) {
    throw Error("Expected memo to be set");
  }

  while (growing) {
    memo.match = m;
    const growScope = m
      .scope
      .withInput(start);

    const result = match(pattern, growScope);
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
}
