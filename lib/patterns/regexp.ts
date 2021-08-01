import { Match } from '../match.ts'
import { Scope } from '../scope.ts'

interface IRegexpArgs {
  pattern: RegExp,
}

export function regexp(args: IRegexpArgs) {
  const { pattern } = args
  return function regexp(scope: Scope) {
    if (!scope.stream.done) {
      const next = scope.stream.next()
      if (typeof next.value === 'string' && pattern.test(next.value)) {
        return Match.Ok(scope, scope.withStream(next), next.value)
      }
    }

    return Match.Fail(scope)
  }
}
