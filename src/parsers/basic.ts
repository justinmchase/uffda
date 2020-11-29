import { pipeline } from '../patterns'
import { Exclusion } from './exclusion'
import { Tokenizer } from './tokenizer'

export const Basic = pipeline({
  steps: [
    Tokenizer,
    Exclusion({
      types: ['Whitespace', 'Newline']
    })
  ]
})
