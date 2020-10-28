import { ok } from 'assert'
import debug from 'debug'
import { Match } from '../match'
import { Scope } from '../scope'
import { any } from './any'
import { Pattern } from './pattern'

const trace = debug('trace')

interface IEqualArgs {
  value: any,
}

export function equal(args: IEqualArgs) {
  const { value } = args
  return function equal(scope: Scope) {
    trace(`- equal@${scope.stream.path}`)
    if (!scope.stream.done) {
      const next = scope.stream.next()
      console.log('equal:', next.value, '===', value)
      if (next.value === value) {
        return Match.Ok(scope, scope.withStream(next), next.value)
      }
    }

    return Match.Fail(scope)
  }
}
