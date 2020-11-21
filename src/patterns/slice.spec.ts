import { deepStrictEqual, equal } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { ok } from './ok'
import { regexp } from './regexp'
import { slice } from './slice'
import { then } from './then'

describe('/patterns/slice', () => {
  it('zero or more matches ok without infinite looping', () => {
    const p = slice({
      pattern: ok
    })
    const s = Scope.From('')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: []
    })
  })

  it('zero or more matches empty set', () => {
    const p = slice({})
    const s = Scope.From('')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: []
    })
  })

  it('zero or more matches a single element', () => {
    const p = slice({})
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a']
    })
  })

  it('zero or more matches multiple elements', () => {
    const p = slice({})
    const s = Scope.From('abc')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', 'b', 'c']
    })
  })

  it('zero or more not matching is still a success', () => {
    const p = then({
      patterns: [
        slice({
          pattern: regexp({ pattern: /a/ })
        }),
        any
      ]
    })
    const s = Scope.From('b')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: [[], 'b']
    })
  })

  it('zero or more not matching at end is still a success', () => {
    const p = then({
      patterns: [
        any,
        slice({
          pattern: regexp({ pattern: /a/ })
        }),
      ]
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', []]
    })
  })

  it('one or more fails ok without infinite looping', () => {
    const p = slice({
      min: 1,
      pattern: ok
    })
    const s = Scope.From('')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: true,
      value: undefined
    })
  })

  it('one or more fails on empty set', () => {
    const p = slice({
      min: 1
    })
    const s = Scope.From('')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: true,
      value: undefined
    })
  })

  it('one or more matches one item', () => {
    const p = slice({
      min: 1
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a']
    })
  })

  it('one or more matches multiple items', () => {
    const p = slice({
      min: 1
    })
    const s = Scope.From('abc')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', 'b', 'c']
    })
  })

  it('exact number matches exactly', () => {
    const p = slice({
      min: 3,
      max: 3
    })
    const s = Scope.From('abc')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', 'b', 'c']
    })
  })

  it('exact number fails with not enough items', () => {
    const p = slice({
      min: 3,
      max: 3
    })
    const s = Scope.From('ab')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })
})
