import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { regexp } from './regexp'

describe('/patterns/regexp', () => {
  it('can match strings with a regexp', () => {
    const p = regexp({
      pattern: /a/
    })
    const s = Scope.From('a')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: 'a'
    })
  })

  it('cannot match non-strings with a regexp', () => {
    const p = regexp({
      pattern: /a/
    })
    const s = Scope.From([1])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })

  it('consumes a single value', () => {
    const p = regexp({
      pattern: /a/
    })
    const s = Scope.From('aa')
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: false,
      value: 'a'
    })
  })
})
