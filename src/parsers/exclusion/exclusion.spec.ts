import { deepStrictEqual } from 'assert'
import { pipeline } from '../../patterns'
import { Tokenizer } from '../tokenizer'
import { Scope } from '../../scope'
import { Exclusion } from '.'

describe('/parsers/exclusion', () => {
  it('can exclude whitespace', () => {
    const p = pipeline({
      steps: [
        {
          name: 'tokenize',
          pattern: Tokenizer
        },
        {
          name: 'exclude whitespace and newlines',
          pattern: Exclusion({ types: ['Whitespace', 'Newline'] })
        }
      ]
    })

    const s = Scope.From('x + y')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: [
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: '+' },
        { type: 'Identifier', value: 'y' }
      ]
    })
  })
})
