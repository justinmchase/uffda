import { Scope } from '../../scope.ts'
import { Match } from '../../match.ts'
import { match } from '../match.ts'
import { IAndPattern } from './pattern.ts'

export function and(args: IAndPattern, scope: Scope): Match {
  const { patterns } = args
  let m = Match.Fail(scope)
  for (const pattern of patterns) {
    const result = match(pattern, scope)
    if (!result.matched)
      return result

    m = result
    scope = scope.addVariables(m.end.variables)
  }
  return m
}