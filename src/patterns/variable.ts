import debug from 'debug'
import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

const trace = debug('trace')

interface IVarArgs {
  pattern: Pattern,
  name: string
}

export function variable(args: IVarArgs) {
  const { name, pattern } = args
  return function variable(scope: Scope) {
    trace(`- variable@${scope.stream.path}`, name, pattern)
    const match = pattern(scope)
    if (match.matched) {
      return Match.Ok(scope, match.end.addVariables({ [name]: match.value }), match.value)
    } else {
      return match
    }
  }
}
