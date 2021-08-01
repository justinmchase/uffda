
import { log } from "../../deps/std.ts"
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { MetaStream } from '../stream.ts'
import { Pattern } from './pattern.ts'


interface IObjectArgs {
  keys?: Record<PropertyKey, Pattern>;
}

export function object(args: IObjectArgs) {
  const { keys = {} } = args
  return function object(scope: Scope) {
    log.debug(`- object@${scope.stream.path}`, Object.keys(keys))
    if (!scope.stream.done) {
      const next = scope.stream.next()
      if (next.value && typeof next.value === 'object') {
        let end = scope
        for (const [key, pattern] of Object.entries(keys) as [string, Pattern][]) {
          log.debug(`- key@${scope.stream.path}`, key, pattern)
          if (!Object.getOwnPropertyDescriptor(next.value, key)) {
            // the next value does not contain the given key
            return Match.Fail(end)
          }

          const objValue = next.value as Record<PropertyKey, unknown>
          const value = [objValue[key]]
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
