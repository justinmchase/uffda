import { ok } from 'assert'
import debug from 'debug'
import { Match } from '../match'
import { Scope } from '../scope'
import { any } from './any'
import { Pattern } from './pattern'

const trace = debug('trace')

interface IOrArgs {
  patterns: Pattern[],
}

export function or(args: IOrArgs) {
  const { patterns } = args
  ok(patterns.length > 0, `At least one pattern must be specified but found ${patterns.length}`)
  return function or(scope: Scope) {
    trace('- or', patterns)
    for (const pattern of patterns) {
      const match = pattern(scope)
      if (match.matched || match.isLr) {
        return match
      }
    }
    return Match.Fail(scope)
  }
}
