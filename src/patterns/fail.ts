import { Match } from '../match'
import { Scope } from '../scope'

export function fail(scope: Scope) {
  return Match.Fail(scope)
}
