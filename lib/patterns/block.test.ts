import { assert } from '../../deps/std.ts'
import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { block } from './block.ts'
import { equal } from './equal.ts'
import { projection } from './projection.ts'
import { rule } from './rule.ts'

tests('patterns.block', () => [
  {
    id: 'BLOCK00',
    description: 'can run main pattern',
    pattern: () => block({
      Main: equal({ value: 'a' })
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'BLOCK01',
    description: 'defaults to last pattern',
    pattern: () => block({
      A: equal({ value: 'a' }),
      B: equal({ value: 'b' }),
    }),
    input: 'b',
    value: 'b',
  },
  {
    id: 'BLOCK02',
    description: 'block values are available as variables',
    pattern: () => block({
      A: any(),
      Main: projection({
        pattern: any(),
        expr: ({ A }) => (assert(A), 7)
      })
    }),
    input: 'x',
    value: 7
  },
  {
    id: 'BLOCK03',
    description: 'higher block values are available as variables',
    pattern: () => block({
      A: any(),
      Main: block({
        B: any(),
        Main: projection({
          pattern: any(),
          expr: ({ A, B }) => (assert(A), assert(B), 7)
        })
      })
    }),
    input: 'x',
    value: 7,
  },
  {
    id: 'BLOCK04',
    description: 'block values are available in rule as variables',
    pattern: () => block({
      A: any(),
      Main: rule({
        name: 'R',
        pattern: projection({
          pattern: any(),
          expr: ({ A }) => (assert(A), 7)
        })
      })
    }),
    input: 'x',
    value: 7,
  }
])
