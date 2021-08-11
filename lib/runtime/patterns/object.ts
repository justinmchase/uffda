import { Match } from '../../match.ts'
import { Scope } from '../../scope.ts'
import { MetaStream } from '../../stream.ts'
import { match } from '../match.ts'
import { Pattern, IObjectPattern } from './pattern.ts'

export function object(args: IObjectPattern, scope: Scope) {
  const { keys = {} } = args
  if (!scope.stream.done) {
    const next = scope.stream.next()
    if (next.value && typeof next.value === 'object') {
      let end = scope
      for (const [key, pattern] of Object.entries(keys) as [string, Pattern][]) {
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
        const m = match(pattern, propertyScope)

        if (!m.matched)
          return m

        if (!m.end.stream.next().done)
          return Match.Incomplete(m.start, m.end, m.value)

        end = end.addVariables(m.end.variables)
      }
      return Match.Ok(scope, end.withStream(next), next.value)
    }
  }
  return Match.Fail(scope)
}
  