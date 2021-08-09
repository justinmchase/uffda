import { Match } from '../match.ts'
import { Scope } from '../scope.ts'

export function number() {
  return function number(scope: Scope): Match {
    if (!scope.stream.done) {
      const end = scope.stream.next()
      if (typeof end.value === 'number') {
        return Match.Ok(scope, scope.withStream(end), end.value as number)
      }
    }

    return Match.Fail(scope)
  }
}
