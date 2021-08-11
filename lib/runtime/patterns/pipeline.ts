import { Match } from '../../match.ts'
import { Path } from '../../path.ts'
import { Scope } from '../../scope.ts'
import { MetaStream } from '../../stream.ts'
import { match } from '../match.ts'
import { IPipelinePattern } from './pattern.ts'

export function pipeline(args: IPipelinePattern, scope: Scope) {
  const { steps } = args
  let result = Match.Default(scope)
  let items = scope.stream.items
  for (let i = 0; i < steps.length; i++) {
    const pattern = steps[i]
    const nextStream = new MetaStream(Path.Default(), items)
    const nextScope = scope.withStream(nextStream)
    result = match(pattern, nextScope)
    if (!result.matched)
      return result

    if (!result.end.stream.next().done)
      return Match.Incomplete(result.start, result.end, result.value)

    // console.log(Deno.inspect(result.value, { colors: true }))

    const iterable = result.value as Iterable<unknown>
    items = iterable?.[Symbol.iterator]
      ? iterable[Symbol.iterator]()
      : [result.value][Symbol.iterator]()
  }

  return result
}
