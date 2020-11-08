import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { Letter } from './Letter'

describe('/parsers/tokenizer/letter', () => {
  it('matches a letter', () => {
    const p = Letter
    const s = Scope.From('a')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'a'
    })
  })

  it('does not match a non-letter', () => {
    const p = Letter
    const s = Scope.From('*')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })

  it('does not match a digit', () => {
    const p = Letter
    const s = Scope.From('1')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })
})
