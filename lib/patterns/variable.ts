import { log } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { Pattern } from './pattern.ts'

interface IVarArgs {
  pattern: Pattern,
  name: string
}

export function variable(args: IVarArgs) {
  const { name, pattern } = args
  return function variable(scope: Scope) {
    log.debug(`- variable@${scope.stream.path}`, name, pattern)
    const match = pattern(scope)
    if (match.matched) {
      return Match.Ok(scope, match.end.addVariables({ [name]: match.value }), match.value)
    } else {
      return match
    }
  }
}
