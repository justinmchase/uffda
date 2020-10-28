import { deepStrictEqual, strictEqual } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { not } from './not'
import { ok } from './ok'
import { fail } from './fail'

describe('/patterns/not', () => {
  it('fails on ok', () => {
    const p = not({ pattern: ok })
    const s = Scope.Default()
    const m = p(s)
    strictEqual(m.matched, false)
  })

  it('succeeds on fail', () => {
    const p = not({ pattern: fail })
    const s = Scope.Default()
    const { matched } = p(s)
    strictEqual(matched, true)
  })

  it('succeeds on not not ok', () => {
    const p = not({ pattern: not({ pattern: ok }) })
    const s = Scope.Default()
    const { matched } = p(s)
    strictEqual(matched, true)
  })

  it('consumes no input', () => {
    const p = not({ pattern: fail })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: false,
      value: undefined
    })
  })
})
