import { deepStrictEqual, throws } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { equal } from './equal'
import { or } from './or'

describe('/patterns/or', () => {
  it('requires at least one pattern', () => {
    throws(() => or({ patterns: [] }))
  })
  it('matches with a single pattern', () => {
    const p = or({
      patterns: [
        any
      ]
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('matches second pattern', () => {
    const p = or({
      patterns: [
        equal({ value: 1 }),
        equal({ value: 2 })
      ]
    })
    const s = Scope.From([2])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 2
    })
  })

  it('fails if no pattern matches', () => {
    const p = or({
      patterns: [
        equal({ value: 1 }),
        equal({ value: 2 })
      ]
    })
    const s = Scope.From([3])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })

  it('consumes only a single input', () => {
    const p = or({
      patterns: [
        equal({ value: 1 })
      ]
    })
    const s = Scope.From([1, 2])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: false,
      value: 1
    })
  })
})
