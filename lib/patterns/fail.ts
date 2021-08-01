import { Match } from '../match.ts'
import { Scope } from '../scope.ts'

export function fail() {
  return function fail(scope: Scope) {
    return Match.Fail(scope)
  }
}
