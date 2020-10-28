import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { Token } from './token'

describe('/parsers/tokenizer/token', () => {
  it('does not match a letter', () => {
    const p = Token
    const s = Scope.From('a')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })

  it('does not match a digit', () => {
    const p = Token
    const s = Scope.From('1')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })

  it('does not match whitespace', () => {
    const p = Token
    const s = Scope.From(' ')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })

  it('matches a non-letter, non-digit, non-whitespace', () => {
    const p = Token
    const s = Scope.From('*')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: '*'
    })
  })
})
