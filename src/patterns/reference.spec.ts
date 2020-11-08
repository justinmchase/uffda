import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { block } from './block'
import { equal } from './equal'
import { reference } from './reference'

describe('/patterns/reference', () => {
  it('can reference other pattern', () => {
    const p = block({
      A: equal({ value: 'a' }),
      Main: reference('A')
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })
})
