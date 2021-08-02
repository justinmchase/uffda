import { assert } from '../../deps/std.ts'
import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { equal } from './equal.ts'
import { or } from './or.ts'
import { projection } from './projection.ts'
import { rule } from './rule.ts'
import { then } from './then.ts'
import { variable } from './variable.ts'

tests('patterns.rule', () => [
  {
    id: 'RULE00',
    description: 'can parse a non-recursive rule',
    pattern: () => rule({
      name: 'a',
      pattern: equal({ value: 'a' })
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'RULE01',
    description: 'non-progressive recursive patterns only match a single item',
    pattern: () => {
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
      return p
    },
    input: 'aa',
    value: 'a',
    done: false
  },
  {
    id: 'RULE02',
    description: 'lr patterns match multiple items',
    pattern: () => {
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
      return p
    },
    input: 'aaa',
    value: [['a', 'a'], 'a'],
  },
  {
    id: 'RULE03',
    description: 'indirect left recursion results in an error',
    pattern: () => {
      const a = rule({
        name: 'a',
        pattern: s => b(s)
      })
      const b = rule({
        name: 'b',
        pattern: s => a(s)
      })
      return a
    },
    input: 'ab',
    matched: false,
    done: false,
  },
  {
    id: 'RULE04',
    description: 'right recursion is fine',
    pattern: () => {
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
      return p
    },
    input: 'aaa',
    value: ['a', ['a', 'a']]
  },
  {
    id: 'RULE05',
    description: 'upper variables should not be available in lower scopes',
    pattern: () => {
      const p0 = rule({
        name: 'P0',
        pattern: projection<unknown, { x: string }>({
          pattern: any(),
          expr: ({ x }) => (assert(x === undefined), true)
        })
      })
      const p1 = rule({
        name: 'P1',
        pattern: then({
          patterns: [
            variable({ name: 'x', pattern: any() }),
            or({
              patterns: [
                s => p0(s),
                any()
              ]
            })
          ]
        })
      })
      return p1
    },
    input: 'ab',
    value: ['a', true],
  },
  {
    id: 'RULE06',
    description: 'lower variables should not be available in upper scope',
    pattern: () => {
      const p0 = rule({
        name: 'P0',
        pattern: projection({
          pattern: variable({
            name: 'x',
            pattern: any()
          }),
          expr: ({ x }) => (assert(x === 'a'), x)
        })
      })
      const p1 = rule({
        name: 'P1',
        pattern: projection({
          pattern: s => p0(s),
          expr: ({ x, _ }) => (assert(x === undefined), _)
        })
      })
      return p1
    },
    input: 'a',
    value: 'a',
  }
])
