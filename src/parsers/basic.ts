import { pipeline } from '../patterns'
import { Exclusion } from './exclusion'
import { Tokenizer } from './tokenizer'

export const Basic = pipeline({
  steps: [
    {
      name: 'tokenize',
      pattern: Tokenizer
    },
    {
      name: 'whitespace insignificant',
      pattern: Exclusion({
        types: ['Whitespace', 'Newline']
      })
    },
  ]
})
