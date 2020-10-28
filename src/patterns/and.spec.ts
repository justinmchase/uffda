import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { and } from './and'
import { any } from './any'
import { regexp } from './regexp'
import { then } from './then'

describe('/patterns/and', () => {
  it('and pattern matches with single pattern', () => {
    const p = and({
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

  it('and pattern matches with two patterns', () => {
    const p = and({
      patterns: [
        any,
        any,
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

  it('and pattern only consumes a single input', () => {
    const p = then({
      patterns: [
        and({
          patterns: [
            any,
            any,
          ]
        }),
        any
      ]
    })
    const s = Scope.From('ab')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a', 'b']
    })
  })

  it('fails if first pattern fails', () => {
    const p = and({
      patterns: [
        regexp({ pattern: /b/ }),
        regexp({ pattern: /a/ })
      ]
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })

  it('fails if second pattern fails', () => {
    const p = and({
      patterns: [
        regexp({ pattern: /a/ }),
        regexp({ pattern: /b/ })
      ]
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })
})
