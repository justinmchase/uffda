import { Stream } from 'stream'
import { Match } from '../match'
import { Scope } from '../scope'
import { MetaStream } from '../stream'
import { Pattern } from './pattern'

interface IObjectArgs {
  keys?: Record<string, Pattern>;
}

export function object(args: IObjectArgs) {
  const { keys = {} } = args
  return function object(scope: Scope) {
    if (!scope.stream.done) {
      const next = scope.stream.next()
      if (typeof next.value === 'object') {
        let end = scope
        for (const [key, pattern] of Object.entries(keys) as [string, Pattern][]) {
          if (!Object.getOwnPropertyDescriptor(next.value, key)) {
            // the next value does not contain the given key
            return Match.Fail(end)
          }

          const value = [next.value[key]]
          const propertyStream = new MetaStream(
            next.path.add(key),
            value[Symbol.iterator]()
          )
          const propertyScope = end.withStream(propertyStream)
          const match = pattern(propertyScope)

          if (!match.matched)
            return match

          if (!match.end.stream.next().done)
            return Match.Incomplete(match.start, match.end, match.value)

          end = end.addVariables(match.end.variables)
        }
        return Match.Ok(scope, end.withStream(next), next.value)
      }
    }
    return Match.Fail(scope)
  }
}
