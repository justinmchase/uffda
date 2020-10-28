import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

interface IVarArgs {
  pattern: Pattern,
  name: string
}

export function variable(args: IVarArgs) {
  const { name, pattern } = args
  return function variable(scope: Scope) {
    const match = pattern(scope)
    if (match.matched) {
      return Match.Ok(scope, match.end.addVariable(name, match.value), match.value)
    } else {
      return match
    }
  }
}
