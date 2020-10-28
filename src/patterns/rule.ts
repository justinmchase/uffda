import { strictEqual, notStrictEqual } from 'assert'
import debug from 'debug'
import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

const trace = debug('trace')

interface IRuleArgs {
  name: string;
  pattern: Pattern;
}

function getKey(scope: Scope, name: string) {
  return `${name}@${scope.stream.path}`
}

export function rule(args: IRuleArgs) {
  const { name, pattern } = args
  return function rule(scope: Scope) {
    const key = getKey(scope, name)
    const memo = scope.memos[key]
    trace(key)
    if (!memo) {
      const subScope = scope
        .setMemo(key, pattern, Match.LR(scope))
        .pushRule(name)
        .setVariables({})

      let match = pattern(subScope)
      if (match.isLr) {
        match = grow(subScope, args)
      }

      const m = match
        .setVariables(scope.variables)
        .endRecursion()
        .popRule()
        .setMemo(key, pattern)

      trace(key, '=', m.matched, m.end.stream.path.toString())
      return m

    } else {
      if (memo.match.isLr) {
        notStrictEqual(scope.ruleStack.length, 0, 'Invalid recursion detected')
        strictEqual(scope.ruleStack.slice(-1)[0], name, `Indirect left recursion detected in rule ${name}`)
        trace(key, 'DLR')
      }
      return memo.match.setEnd(scope.withStream(memo.match.end.stream))
    }
  }
}

function grow(scope: Scope, args: IRuleArgs) {
  const { name, pattern } = args
  const key = getKey(scope, name)
  let match = Match.Fail(scope)
  const start = scope.stream
  while (true) {
    const growScope = match
      .end
      .setMemo(key, pattern, match)
      .withStream(start)

    const result = pattern(growScope)
    const progressed = result.end.stream.path.compareTo(match.end.stream.path) > 0
    const { matched, value } = result
    trace(key, 'GROW', { matched, progressed, value })
    if (!matched || !progressed) {
      break
    }

    match = result
  }

  return match
}
