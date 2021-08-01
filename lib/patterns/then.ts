import { log } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { ok } from './ok.ts'
import { Pattern } from './pattern.ts'

interface IAndArgs {
  patterns: Pattern[]
}

export function then(args: IAndArgs): Pattern {
  const { patterns } = args
  if (patterns.length === 0) return ok()
  return function then(scope: Scope) {
    log.debug(`- then@${scope.stream.path}`)
    let end = scope
    const values: unknown[] = []
    for (const pattern of patterns) {
      const match = pattern(end)
      if (!match.matched)
        return match

      end = match.end
      values.push(match.value)
    }

    return Match.Ok(scope, end, values)
  }
}
