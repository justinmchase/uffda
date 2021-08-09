import { pipeline } from '../patterns/mod.ts'
import { Exclude } from './exclusion/mod.ts'
import { Lang } from './lang/mod.ts'
import { Tokenizer } from './tokenizer/mod.ts'
// import { Compiler } from './compiler/mod.ts'

export const meta = pipeline({
  steps: [
    Tokenizer,
    Exclude({ types: ['Whitespace', 'Newline'] }),
    Lang,
    // Compiler,
  ]
})
