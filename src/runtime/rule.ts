import { brightBlack, cyan, underline } from "std/fmt/colors.ts";
import { Match } from "../match.ts";
import { Scope } from "../scope.ts";
import { Rule } from "./modules/mod.ts";
import { match } from "./match.ts";
import { RuntimeError, RuntimeErrorCode } from "./runtime.error.ts";

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
      if (scope.ruleStack.length === 0) {
        // This should never happen unless there is a bug in this code base
        throw new RuntimeError(
          RuntimeErrorCode.IndirectLeftRecursion,
          rule.module,
          rule,
          rule.pattern,
          memo.match,
        );
      }
      if (!Object.is(scope.ruleStack.slice(-1)[0], rule)) {
        return Match.Fail(scope);
      }
    }
    return memo.match.setEnd(scope.withInput(memo.match.end.stream));
  }
}

function grow(rule: Rule, scope: Scope): Match {
  const { pattern } = rule;
  let m = Match.Fail(scope);
  const start = scope.stream;
  const memo = scope.memos.get(start.path, rule);
  while (memo) {
    if (scope.options.trace) {
      const indent = "»".padStart(scope.depth);
      console.log(`${indent} ${underline(brightBlack("grow..."))}`);
    }
    memo.match = m;
    const growScope = m
      .end
      .withInput(start);

    const result = match(pattern, growScope);
    const progressed = result.end.stream.path.compareTo(m.end.stream.path) > 0;
    const { matched } = result;

    if (scope.options.trace) {
      const indent = "»".padStart(scope.depth);
      const message = matched && progressed
        ? underline(cyan(`progressed (${result.end.stream.path})`))
        : matched
        ? underline(brightBlack("no progress."))
        : underline(brightBlack("not matched."));
      console.log(`${indent} ${message}`);
    }

    if (!matched || !progressed) {
      break;
    }

    m = result;
  }

  return m;
}
