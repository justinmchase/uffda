import { log } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'

interface IEqualArgs {
  value: unknown,
}

export function equal(args: IEqualArgs) {
  const { value } = args
  return function equal(scope: Scope) {
    log.debug(`- equal@${scope.stream.path}`)
    if (!scope.stream.done) {
      const next = scope.stream.next()
      log.debug('- equal', value, next.value)
      if (next.value === value) {
        return Match.Ok(scope, scope.withStream(next), next.value)
      }
    }

    return Match.Fail(scope)
  }
}
