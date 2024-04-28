import { Match } from "../match.ts";
import { Scope } from "./scope.ts";
import { Rule } from "./modules/mod.ts";
import { match } from "./match.ts";
import { RuntimeError, RuntimeErrorCode } from "./runtime.error.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";

export function rule(rule: Rule, scope: Scope): Match {
  const { module, pattern } = rule;
  let memo = scope.memos.get(scope.stream.path, rule);
  if (!memo) {
    memo = scope.memos.set(scope.stream.path, rule, Match.LR(scope));
    const subScope = scope
      .pushModule(module)
      .pushRule(rule);

    let m = match(pattern, subScope);
    if (m.isLr) {
      m = grow(rule, subScope);
    }
    memo.match = m;
    return m.endRecursion().pop(scope);
  } else {
    if (memo.match.isLr) {
      const frame = scope.stack[scope.stack.length - 1];
      if (frame?.kind !== StackFrameKind.Rule) {
        // This should never happen unless there is a bug in this code base
        throw new RuntimeError(
          RuntimeErrorCode.IndirectLeftRecursion,
          scope,
          memo.match,
        );
      }
      if (!Object.is(frame.rule, rule)) {
        return Match.Fail(scope, rule.pattern);
      }
    }
    return memo.match.setEnd(scope.withInput(memo.match.end.stream));
  }
}

function grow(rule: Rule, scope: Scope): Match {
  const { pattern } = rule;

  let m = Match.Fail(scope, pattern);
  const start = scope.stream;
  const memo = scope.memos.get(start.path, rule);
  while (memo) {
    memo.match = m;
    const growScope = m
      .end
      .withInput(start);

    const result = match(pattern, growScope);
    const progressed = result.end.stream.path.compareTo(m.end.stream.path) > 0;
    const { matched } = result;
    if (!matched || !progressed) {
      break;
    }

    m = result;
  }

  return m;
}
