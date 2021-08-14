import { Scope } from '../../scope.ts'
import { Match, MatchError } from '../../match.ts'
import { match } from '../match.ts'
import { IAndPattern } from './pattern.ts'

export function and(args: IAndPattern, scope: Scope): Match {
  const { patterns } = args
  const errors: MatchError[] = []
  let m = Match.Fail(scope)
  for (const pattern of patterns) {
    m = match(pattern, scope)
    errors.push(...m.errors)
    scope = scope.addVariables(m.end.variables)

    if (!m.matched)
      break
  }

  return m.setErrors(errors)
}