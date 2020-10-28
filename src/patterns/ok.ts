import { Match } from '../match'
import { Scope } from '../scope'

export function ok(scope: Scope) {
  return Match.Default(scope)
}
