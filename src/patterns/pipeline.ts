import debug from 'debug'
import { Match } from '../match'
import { Path } from '../path'
import { Scope } from '../scope'
import { MetaStream } from '../stream'
import { Pattern } from './pattern'

const trace = debug('trace')

interface IPipelineArgs {
  steps: Pattern[]
}

export function pipeline(args: IPipelineArgs) {
  const { steps } = args
  return function pipeline(scope: Scope) {
    let result = Match.Default(scope)
    let items = scope.stream.items
    for (let i = 0; i < steps.length; i++) {
      const pattern = steps[i]
      const nextStream = new MetaStream(Path.Default(), items)
      const nextScope = scope.withStream(nextStream)
      result = pattern(nextScope)
      if (!result.matched)
        return result

      if (!result.end.stream.next().done)
        return Match.Incomplete(result.start, result.end, result.value)

      items = result?.value[Symbol.iterator]
        ? result.value[Symbol.iterator]()
        : [result.value][Symbol.iterator]()

      console.log('STEP', i, pattern, JSON.stringify(result.value, null, 2))
    }

    return result
  }
}
