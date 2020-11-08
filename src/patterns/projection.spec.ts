import { deepStrictEqual, strictEqual } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { not } from './not'
import { ok } from './ok'
import { fail } from './fail'
import { projection } from './projection'

describe('/patterns/projection', () => {
  it('calls expression on match', () => {
    const p = projection({
      pattern: any,
      expr: () => 11
    })
    const s = Scope.From([7])
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 11
    })
  })

  it('provides variables as an argument', () => {
    const p = projection({
      pattern: any,
      expr: ({ v0 }) => v0
    })
    const s = Scope.From([7]).addVariables({ v0: 11 })
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 11
    })
  })

  it('provides projections as an argument', () => {
    const $0 = () => 11
    const p = projection({
      pattern: any,
      expr: ({ $0 }) => $0()
    })
    const s = Scope.From([7]).addVariables({ $0 })
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 11
    })
  })
})
