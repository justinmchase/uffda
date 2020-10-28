import { any, slice, regexp, or, projection, variable, then, object, pipeline } from '../patterns'
import { Exclusion } from './exclusion'
import { Lang } from './lang'
import { Tokenizer } from './tokenizer'

export const meta = pipeline({
  steps: [
    { name: 'tokenize', pattern: Tokenizer },
    { name: 'whitespace insignificant', pattern: Exclusion({ types: ['Whitespace', 'Newline'] }) },
    { name: 'lang', pattern: Lang },
  ]
})
