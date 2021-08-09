import { pipeline } from '../patterns/mod.ts'
import { Exclude } from './exclusion/mod.ts'
import { Tokenizer } from './tokenizer/mod.ts'

export const Basic = pipeline({
  steps: [
    Tokenizer,
    Exclude({
      types: ['Whitespace', 'Newline']
    })
  ]
})
