import { deepStrictEqual, strictEqual } from 'assert'
import { Scope } from '../scope'
import { any } from './any'

describe('/patterns/any', () => {
  it('reads string successfully', () => {
    const p = any
    const s = Scope.From('a')
    const m = p(s)
    strictEqual(m.matched && m.done, true)
    strictEqual(m.value, 'a')
  })

  it('reads array successfully', () => {
    const p = any
    const s = Scope.From(['a'])
    const m = p(s)
    strictEqual(m.matched && m.done, true)
    strictEqual(m.value, 'a')
  })

  it('fails to read empty stream', () => {
    const p = any
    const s = Scope.From('')
    const m = p(s)
    strictEqual(m.matched, false)
    strictEqual(m.done, true)
  })

  it('reads exactly 1 input', () => {
    const p = any
    const s = Scope.From('ab')
    const m = p(s)
    strictEqual(m.matched, true)
    strictEqual(m.done, false)
    strictEqual(m.value, 'a')
  })
})
