import { tests } from '../../pattern.test.ts'
import { Tokenizer } from './mod.ts'

tests('parsers.tokenizer', () => [
  {
    id: 'TOKENIZER00',
    description: 'succeeds on empty input',
    pattern: () => Tokenizer,
    input: '',
    value: [],
    matched: true,
    done: true,
  },
  {
    id: 'TOKENIZER01',
    description: 'succeeds on whitespace',
    pattern: () => Tokenizer,
    input: ' ',
    value: [
      { type: 'Whitespace', value: ' ' },
    ],
    matched: true,
    done: true,
  },
  {
    id: 'WHITESPACE03',
    description: 'succeeds on multiple lines',
    pattern: () => Tokenizer,
    input: '   \n   \n   ',
    value: [
      { type: 'Whitespace', value: '   ' },
      { type: 'Newline', value: '\n' },
      { type: 'Whitespace', value: '   ' },
      { type: 'Newline', value: '\n' },
      { type: 'Whitespace', value: '   ' },
    ]
  },
  {
    id: 'WHITESPACE04',
    description: 'successfully parses expressions',
    pattern: () => Tokenizer,
    input: 'x + y - 1 -> $0',
    value: [
      { type: 'Identifier', value: 'x' },
      { type: 'Whitespace', value: ' ' },
      { type: 'Token', value: '+' },
      { type: 'Whitespace', value: ' ' },
      { type: 'Identifier', value: 'y' },
      { type: 'Whitespace', value: ' ' },
      { type: 'Token', value: '-' },
      { type: 'Whitespace', value: ' ' },
      { type: 'Integer', value: 1 },
      { type: 'Whitespace', value: ' ' },
      { type: 'Token', value: '-' },
      { type: 'Token', value: '>' },
      { type: 'Whitespace', value: ' ' },
      { type: 'SpecialIdentifier', value: '$0' },
    ]
  },
])
