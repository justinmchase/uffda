import { any, slice, regexp, or, projection, variable, then } from '../../patterns'
import { String } from './String'
import { Whitespace } from './Whitespace'
import { Integer } from './Integer'
import { Identifier } from './Identifier'
import { Token } from './Token'
import { Newline } from './Newline'
import { SpecialIdentifier } from './SpecialIdentifier'

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
        pattern: SpecialIdentifier,
        expr: ({ _ }) => ({ type: 'SpecialIdentifier', value: _ })
      }),
      projection({
        pattern: Identifier,
        expr: ({ _ }) => ({ type: 'Identifier', value: _ })
      }),
      projection({
        pattern: String,
        expr: ({ _ }) => ({ type: 'String', value: _ })
      }),
      projection({
        pattern: Token,
        expr: ({ _ }) => ({ type: 'Token', value: _ })
      }),
    ]
  })
})
