import { Match } from '../../match.ts'
import { Scope } from '../../scope.ts'

export function any(scope: Scope): Match {
  if (!scope.stream.done) {
    const end = scope.stream.next()
    return Match.Ok(scope, scope.withStream(end), end.value)
  }
  return Match.Fail(scope)
}
