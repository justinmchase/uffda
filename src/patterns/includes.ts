import { ok } from 'assert'
import { Match } from '../match'
import { Scope } from '../scope'
import { any } from './any'
import { Pattern } from './pattern'

interface IIncludesArgs {
  values: any[],
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
