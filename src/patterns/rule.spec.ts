import { deepStrictEqual, strict, strictEqual, throws } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { array } from './array'
import { equal } from './equal'
import { or } from './or'
import { projection } from './projection'
import { rule } from './rule'
import { then } from './then'
import { variable } from './variable'

describe('/patterns/rule', () => {
  it('can parse a non-recursive rule', () => {
    const p = rule({
      name: 'a',
      pattern: equal({ value: 'a' })
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('non-progressive recursive patterns only match a single item', () => {
    const p = rule({
      name: 'a',
      // a = a | 'a'
      pattern: or({
        patterns: [
          s => p(s),
          equal({ value: 'a' })
        ]
      })
    })
    const s = Scope.From('aa')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: false,
      value: 'a'
    })
  })

  it('lr patterns match multiple items', () => {
    const p = rule({
      name: 'a',
      // a = a 'a' | 'a'
      pattern: or({
        patterns: [
          then({
            patterns: [
              s => p(s),
              equal({ value: 'a' })
            ]
          }),
          equal({ value: 'a' })
        ]
      })
    })
    const s = Scope.From('aaa')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: [['a', 'a'], 'a']
    })
  })

  it('indirect left recursion results in an error', () => {
    const a = rule({
      name: 'a',
      pattern: s => b(s)
    })
    const b = rule({
      name: 'b',
      pattern: s => a(s)
    })
    const s = Scope.From('a')
    throws(() => a(s))
  })

  it('right recursion is fine', () => {
    const p = rule({
      name: 'a',
      // a = 'a' a | 'a'
      pattern: or({
        patterns: [
          then({
            patterns: [
              equal({ value: 'a' }),
              s => p(s),
            ]
          }),
          equal({ value: 'a' })
        ]
      })
    })
    const s = Scope.From('aaa')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', ['a', 'a']]
    })
  })

  describe('/scoping/variables', () => {
    it('upper variables should not be available in lower scopes', () => {
      const p0 = rule({
        name: 'P0',
        pattern: projection({
          pattern: any,
          expr: ({ x }) => (strictEqual(x, undefined), true)
        })
      })
      const p1 = rule({
        name: 'P1',
        pattern: then({
          patterns: [
            variable({ name: 'x', pattern: any }),
            or({
              patterns: [
                s => p0(s),
                any
              ]
            })
          ]
        })
      })
      const s = Scope.From('ab')
      const { matched, value, done } = p1(s)
      deepStrictEqual({ matched, value, done }, {
        matched: true,
        done: true,
        value: ['a', true]
      })
    })

    it('lower variables should not be available in upper scope', () => {
      const p0 = rule({
        name: 'P0',
        pattern: projection({
          pattern: variable({
            name: 'x',
            pattern: any
          }),
          expr: ({ x }) => (strictEqual(x, 'a'), x)
        })
      })
      const p1 = rule({
        name: 'P1',
        pattern: projection({
          pattern: s => p0(s),
          expr: ({ x, _ }) => (strictEqual(x, undefined), _)
        })
      })
      const s = Scope.From('a')
      const { matched, value, done } = p1(s)
      deepStrictEqual({ matched, value, done }, {
        matched: true,
        done: true,
        value: 'a'
      })
    })
  })
})
