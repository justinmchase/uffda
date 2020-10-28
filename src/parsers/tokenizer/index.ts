import { any, slice, regexp, or, projection, variable, then } from '../../patterns'
import { StringPattern } from './StringPattern'
import { Whitespace } from './whitespace'
import { Integer } from './integer'
import { Identifier } from './identifier'
import { Token } from './token'
import { Newline } from './newline'

export const Tokenizer = slice({
  min: 0,
  pattern: or({
    patterns: [
      projection({
        pattern: Newline,
        expr: ({ _ }) => ({ type: 'Newline', value: _ })
      }),
      projection({
        pattern: Whitespace,
        expr: ({ _ }) => ({ type: 'Whitespace', value: _ })
      }),
      projection({
        pattern: Integer,
        expr: ({ _ }) => ({ type: 'Integer', value: parseInt(_) })
      }),
      projection({
        pattern: Identifier,
        expr: ({ _ }) => ({ type: 'Identifier', value: _ })
      }),
      projection({
        pattern: StringPattern,
        expr: ({ _ }) => ({ type: 'String', value: _ })
      }),
      projection({
        pattern: Token,
        expr: ({ _ }) => ({ type: 'Token', value: _ })
      }),
    ]
  })
})

