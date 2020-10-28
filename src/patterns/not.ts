import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

interface INotArgs {
  pattern: Pattern
}

export function not(args: INotArgs) {
  const { pattern } = args
  return function not(scope: Scope) {
    const m = pattern(scope)
    if (!m.matched)
      return Match.Default(scope)

    return Match.Fail(scope)
  }
}
