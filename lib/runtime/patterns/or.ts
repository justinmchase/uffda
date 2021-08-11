import { Match } from '../../match.ts'
import { Scope } from '../../scope.ts'
import { match } from '../match.ts'
import { IOrPattern } from './pattern.ts'

export function or(args: IOrPattern, scope: Scope) {
  const { patterns } = args
  for (const pattern of patterns) {
    const m = match(pattern, scope)
    if (m.matched || m.isLr) {
      return m
    }
  }
  return Match.Fail(scope)
}