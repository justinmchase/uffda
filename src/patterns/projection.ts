import debug from 'debug'
import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

const trace = debug('trace')

interface IProjectionArgs {
  pattern: Pattern,
  expr: Function
}

export function projection(args: IProjectionArgs) {
  const { pattern, expr } = args
  return function projection(scope: Scope) {
    trace(`- projection@${scope.stream.path}`)
    const match = pattern(scope)
    if (!match.matched)
      return match

    const variables = Object.assign({}, match.end.variables, { _: match.value })
    const value = expr(variables)
    return Match.Ok(scope, match.end, value)
  }
}
