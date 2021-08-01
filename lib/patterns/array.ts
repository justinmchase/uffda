import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { MetaStream } from '../stream.ts'
import { Pattern } from './pattern.ts'

interface IArrayArgs {
  pattern: Pattern
}

export function array(args: IArrayArgs) {
  const { pattern } = args
  return function array(scope: Scope) {
    if (!scope.stream.done) {
      const next = scope.stream.next()
      if (Array.isArray(next.value)) {
        const innerStream = new MetaStream(
          next.path.add(-1),
          next.value[Symbol.iterator]()
        )
        const innerScope = scope.withStream(innerStream)
        const match = pattern(innerScope)

        if (!match.matched)
          return Match.Fail(scope)

        if (!match.end.stream.done)
          return Match.Incomplete(match.start, match.end, match.value)

        return match
      }
    }
    return Match.Fail(scope)
  }
}
