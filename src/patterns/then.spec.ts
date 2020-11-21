import { deepStrictEqual, strictEqual } from 'assert'
import { Scope } from '../scope'
import { then } from './then'
import { any } from './any'
import { ok } from './ok'

describe('/patterns/then', () => {
  it('no patterns is success', () => {
    const p = then({
      patterns: []
    })
    const s = Scope.Default()
    const m = p(s)
    strictEqual(m.matched && m.done, true)
  })

  it('reads one pattern successfuly', () => {
    const p = then({
      patterns: [any]
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: ['a']
    })
  })

  it('reads two patterns successfuly', () => {
    const p = then({
      patterns: [any, any]
    })
    const s = Scope.From('ab')
    const m = p(s)
    strictEqual(m.matched && m.done, true)
    deepStrictEqual(m.value, ['a', 'b'])
  })

  it('does not read too much', () => {
    const p = then({
      patterns: [any, any]
    })
    const s = Scope.From('abc')
    const m = p(s)
    strictEqual(m.matched, true)
    strictEqual(m.done, false)
    deepStrictEqual(m.value, ['a', 'b'])
  })

  it('it doesnt fail if at the end', () => {
    const p = then({
      patterns: [ok]
    })
    const s = Scope.Default()
    const m = p(s)
    strictEqual(m.matched, true)
    strictEqual(m.done, true)
    deepStrictEqual(m.value, [undefined])
  })

  it('it fails if it reaches the end', () => {
    const p = then({
      patterns: [any, any]
    })
    const s = Scope.From('a')
    const m = p(s)
    strictEqual(m.matched, false)
    strictEqual(m.done, true)
    deepStrictEqual(m.value, undefined)
  })
})
