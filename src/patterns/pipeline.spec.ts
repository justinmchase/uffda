import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { pipeline } from './pipeline'
import { projection } from './projection'
import { slice } from './slice'

describe('/patterns/pipeline', () => {
  it('succeeds with single step', () => {
    const p = pipeline({
      steps: [
        { name: 'first', pattern: any }
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

  it('succeeds with two steps', () => {
    const p = pipeline({
      steps: [
        { name: 'first', pattern: projection({ pattern: any, expr: () => 1 }) },
        { name: 'second', pattern: projection({ pattern: any, expr: () => 2 }) },
      ]
    })
    const s = Scope.From([0])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 2
    })
  })

  it('output of previous step is input of next step', () => {
    const p = pipeline({
      steps: [
        {
          name: 'first',
          pattern: projection({
            pattern: slice({ pattern: any }),
            expr: ({ _ }) => _.map(n => n + 1)
          })
        },
        {
          name: 'second',
          pattern: projection({
            pattern: slice({ pattern: any }),
            expr: ({ _ }) => _.map(n => n * 2)
          })
        }
      ]
    })
    const s = Scope.From([1, 2, 3])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: [4, 6, 8]
    })
  })

  it('non-iterable output is wrapped in an iterable for next step', () => {
    const p = pipeline({
      steps: [
        {
          name: 'first',
          pattern: any
        },
        {
          name: 'second',
          pattern: projection({
            pattern: slice({ pattern: any }),
            expr: ({ _ }) => _.map(n => n * 2)
          })
        }
      ]
    })
    const s = Scope.From([11])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: [22]
    })
  })


  it('non-iterable output of final step is not wrapped in an iterable for final output', () => {
    const p = pipeline({
      steps: [
        {
          name: 'first',
          pattern: projection({
            pattern: slice({ pattern: any }),
            expr: ({ _ }) => _.reduce((i, n) => i + n, 0)
          })
        }
      ]
    })
    const s = Scope.From([1, 2, 3])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 6
    })
  })
})
