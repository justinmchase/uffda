import { any, slice, regexp, or, projection, variable, then, object, pipeline } from '../patterns'
import { Exclusion } from './exclusion'
import { Lang } from './lang'
import { Tokenizer } from './tokenizer'
import { Compiler } from './compiler'

export const meta = pipeline({
  steps: [
    { name: 'tokenize', pattern: Tokenizer },
    { name: 'whitespace insignificant', pattern: Exclusion({ types: ['Whitespace', 'Newline'] }) },
    { name: 'lang', pattern: Lang },
    { name: 'compile', pattern: Compiler },
  ]
})
