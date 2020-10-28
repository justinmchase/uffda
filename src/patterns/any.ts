import { Match } from '../match'
import { Scope } from '../scope'

export function any(scope: Scope) {
  if (!scope.stream.done) {
    const end = scope.stream.next()
    return Match.Ok(scope, scope.withStream(end), end.value)
  }

  return Match.Fail(scope)
}
