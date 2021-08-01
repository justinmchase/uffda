import { log, assert } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { Pattern } from './pattern.ts'


interface IOrArgs {
  patterns: Pattern[],
}

export function or(args: IOrArgs) {
  const { patterns } = args
  assert(patterns.length > 0, `At least one pattern must be specified but found ${patterns.length}`)
  return function or(scope: Scope) {
    log.debug('- or', patterns)
    for (const pattern of patterns) {
      const match = pattern(scope)
      if (match.matched || match.isLr) {
        return match
      }
    }
    return Match.Fail(scope)
  }
}
