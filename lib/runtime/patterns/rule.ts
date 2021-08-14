import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { match } from "../match.ts";
import { hash } from "../hash.ts";
import { IRulePattern, Pattern } from "./pattern.ts";

function getKey(pattern: Pattern, scope: Scope) {
  const id = hash(pattern);
  return `${id}@${scope.stream.path}`;
}

export function rule(args: IRulePattern, scope: Scope): Match {
  const { pattern } = args;
  const key = getKey(pattern, scope);
  const memo = scope.memos[key];
  if (!memo) {
    const subScope = scope
      .setMemo(key, pattern, Match.LR(scope))
      .pushRule(key);

    let m = match(pattern, subScope);
    if (m.isLr) {
      m = grow(args, subScope);
    }

    return m
      .endRecursion()
      .popRule(scope)
      .setMemo(key, args);
  } else {
    if (memo.match.isLr) {
      // todo: make a proper error object
      if (scope.ruleStack.length === 0) {
        // This should never happen unless there is a bug in this code base
        return Match
          .Fail(scope)
          .pushError(scope, scope); // todo: Add error messages or codes of some kind
      }
      if (scope.ruleStack.slice(-1)[0] !== key) {
        return Match.Fail(scope);
      }
    }
    return memo.match.setEnd(scope.withStream(memo.match.end.stream));
  }
}

function grow(args: IRulePattern, scope: Scope): Match {
  const { pattern } = args;
  const key = getKey(pattern, scope);
  let m = Match.Fail(scope);
  const start = scope.stream;
  while (true) {
    const growScope = m
      .end
      .setMemo(key, pattern, m)
      .withStream(start);

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
