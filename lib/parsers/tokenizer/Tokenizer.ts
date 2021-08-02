import { slice, or, projection } from '../../patterns/mod.ts'
import { String } from './String.ts'
import { Whitespace } from './Whitespace.ts'
import { Integer } from './Integer.ts'
import { Identifier } from './Identifier.ts'
import { Token } from './Token.ts'
import { Newline } from './Newline.ts'
import { SpecialIdentifier } from './SpecialIdentifier.ts'

export enum TokenizerType {
  Newline = 'Newline',
  Whitespace = 'Whitespace',
  Integer = 'Integer',
  SpecialIdentifier = 'SpecialIdentifier',
  Identifier = 'Identifier',
  String = 'String',
  Token = 'Token'
}

export const Tokenizer = slice({
  min: 0,
  pattern: or({
    patterns: [
      projection({
        pattern: Newline,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.Newline, value: _ })
      }),
      projection({
        pattern: Whitespace,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.Whitespace, value: _ })
      }),
      projection({
        pattern: Integer,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.Integer, value: parseInt(_) })
      }),
      projection({
        pattern: SpecialIdentifier,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.SpecialIdentifier, value: _ })
      }),
      projection({
        pattern: Identifier,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.Identifier, value: _ })
      }),
      projection({
        pattern: String,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.String, value: _ })
      }),
      projection({
        pattern: Token,
        expr: ({ _ }: { _: string }) => ({ type: TokenizerType.Token, value: _ })
      }),
    ]
  })
})
