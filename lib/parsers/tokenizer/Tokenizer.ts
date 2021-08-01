import { slice, or, projection } from '../../patterns/mod.ts'
import { String } from './String.ts'
import { Whitespace } from './Whitespace.ts'
import { Integer } from './Integer.ts'
import { Identifier } from './Identifier.ts'
import { Token } from './Token.ts'
import { Newline } from './Newline.ts'
import { SpecialIdentifier } from './SpecialIdentifier.ts'

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
