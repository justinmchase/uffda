import { any, slice, regexp, or, projection, variable, then, object, pipeline } from '../patterns'
import { Exclusion } from './exclusion'
import { Lang } from './lang'
import { Tokenizer } from './tokenizer'
import { Compiler } from './compiler'

export const meta = pipeline({
  steps: [
    Tokenizer,
    Exclusion({ types: ['Whitespace', 'Newline'] }),
    Lang,
    Compiler,
  ]
})
