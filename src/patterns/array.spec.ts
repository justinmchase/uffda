import { deepStrictEqual, strict, strictEqual } from 'assert'
import { Scope } from '../scope'
import { then } from './then'
import { any } from './any'
import { array } from './array'
import { not } from './not'
import { slice } from './slice'

describe('/patterns/array', () => {
  it('matches explicit empty array', () => {
    const p = array({
      pattern: not({ pattern: any })
    })
    const s = Scope.From([[]])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: undefined
    })
  })

  it('matches array with 1 item', () => {
    const p = array({
      pattern: any
    })
    const s = Scope.From([['a']])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('matches array with 2 item', () => {
    const p = array({
      pattern: then({
        patterns: [
          any,
          any,
        ]
      })
    })
    const s = Scope.From([['a', 'b']])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', 'b']
    })
  })
  
  it('slicing an array with 2 item matches all items', () => {
    const p = array({
      pattern: slice({
        pattern: any
      })
    })
    const s = Scope.From([['a', 'b']])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', 'b']
    })
  })


  it('fails if all items in array are not matched', () => {
    const p = array({
      pattern: any
    })
    const s = Scope.From([['a', 'b']])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: 'a',
    })
  })

  it('matches array with an array', () => {
    const p = array({
      pattern: array({
        pattern: any
      })
    })
    const s = Scope.From([[['a']]])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('match outside of array fails', () => {
    const p = array({
      pattern: then({
        patterns: [
          any,
          any
        ]
      })
    })
    const s = Scope.From([['a'], 'b'])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })
})
