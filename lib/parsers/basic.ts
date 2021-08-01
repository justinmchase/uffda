import { pipeline } from '../patterns/mod.ts'
import { Exclusion } from './exclusion/mod.ts'
import { Tokenizer } from './tokenizer/mod.ts'

export const Basic = pipeline({
  steps: [
    Tokenizer,
    Exclusion({
      types: ['Whitespace', 'Newline']
    })
  ]
})
