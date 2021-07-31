import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { Integer } from './Integer'

describe('/parsers/tokenizer/integer', () => {
  it('can match a single digit', () => {
    const p = Integer
    const s = Scope.From('1')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: '1'
    })
  })

  it('can match multiple digits', () => {
    const p = Integer
    const s = Scope.From('123')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: '123'
    })
  })
})
