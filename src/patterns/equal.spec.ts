import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { equal } from './equal'

describe('/patterns/equal', () => {
  it('matches exact string', () => {
    const p = equal({
      value: 'a'
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('matches exact number', () => {
    const p = equal({
      value: 7
    })
    const s = Scope.From([7])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 7
    })
  })

  it('fails to match wrong number', () => {
    const p = equal({
      value: 7
    })
    const s = Scope.From([11])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })
})
