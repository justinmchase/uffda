
import { log } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { Pattern } from './pattern.ts'

interface IRuleArgs {
  name: string;
  pattern: Pattern;
}

function getKey(scope: Scope, name: string) {
  return `${name}@${scope.stream.path}`
}

export function rule(args: IRuleArgs) {
  const { name, pattern } = args
  const fn = {
    [name]: function (scope: Scope) {
      const key = getKey(scope, name)
      const memo = scope.memos[key]
      log.debug('rule:', key)
      if (!memo) {
        const subScope = scope
          .setMemo(key, pattern, Match.LR(scope))
          .pushRule(name)

        let match = pattern(subScope)
        if (match.isLr) {
          match = grow(subScope, args)
        }

        const m = match
          .endRecursion()
          .popRule(scope)
          .setMemo(key, pattern)

        log.debug(key, '=', m.matched, m.end.stream.path.toString())
        return m

      } else {
        if (memo.match.isLr) {
          // todo: make a proper error object
          if (scope.ruleStack.length === 0) {
            // This should never happen unless there is a bug in this code base
            throw new Error('Invalid recursion detected')
          }
          if (scope.ruleStack.slice(-1)[0] !== name) {
            return Match.Fail(scope)
          }
          log.debug(key, 'DLR')
        }
        return memo.match.setEnd(scope.withStream(memo.match.end.stream))
      }
    }
  }

  return fn[name]
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
    log.debug(key, 'GROW', { matched, progressed, value })
    if (!matched || !progressed) {
      break
    }

    match = result
  }

  return match
}
