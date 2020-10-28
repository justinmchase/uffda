import debug from 'debug'
import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

const trace = debug('trace')
interface IAndArgs {
  patterns: Pattern[]
}

export function then(args: IAndArgs) {
  const { patterns } = args
  return function then(scope: Scope) {
    trace(`- then@${scope.stream.path}`)
    let end = scope
    const values: any[] = []
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
