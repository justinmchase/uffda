import { deepStrictEqual, ok } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { block } from './block'
import { equal } from './equal'
import { projection } from './projection'
import { rule } from './rule'

describe('/patterns/block', () => {
  it('can run main pattern', () => {
    const p = block({
      Main: equal({ value: 'a' })
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('defaults to last pattern', () => {
    const p = block({
      A: equal({ value: 'a' }),
      B: equal({ value: 'b' }),
    })
    const s = Scope.From('b')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'b'
    })
  })

  it('block values are available as variables', () => {
    const p = block({
      A: any,
      Main: projection({
        pattern: any,
        expr: ({ A }) => (ok(A), 7)
      })
    })

    const s = Scope.From('x')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 7
    })
  })

  it('higher block values are available as variables', () => {
    const p = block({
      A: any,
      Main: block({
        B: any,
        Main: projection({
          pattern: any,
          expr: ({ A, B }) => (ok(A), ok(B), 7)
        })
      })
    })

    const s = Scope.From('x')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 7
    })
  })

  it('block values are available in rule as variables', () => {
    const p = block({
      A: any,
      Main: rule({
        name: 'R',
        pattern: projection({
          pattern: any,
          expr: ({ A }) => (ok(A), 7)
        })
      })
    })

    const s = Scope.From('x')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 7
    })
  })
})
