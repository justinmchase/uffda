import { Match } from '../match.ts'
import { Scope } from '../scope.ts'

interface IIncludesArgs {
  values: unknown[],
}

export function includes(args: IIncludesArgs) {
  const { values } = args
  return function equal(scope: Scope) {
    if (!scope.stream.done) {
      const next = scope.stream.next()
      if (values.includes(next.value)) {
        return Match.Ok(scope, scope.withStream(next), next.value)
      }
    }

    return Match.Fail(scope)
  }
}
