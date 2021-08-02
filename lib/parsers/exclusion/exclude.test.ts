import { tests } from '../../pattern.test.ts'
import { pipeline } from '../../patterns/mod.ts'
import { Tokenizer } from '../tokenizer/mod.ts'
import { Exclude } from './Exclude.ts'

tests('parsers.exclusion', () => [
  {
    id: 'EXCLUDE00',
    description: 'can exclude whitespace and newlines',
    pattern: () => pipeline({
      steps: [
        Tokenizer,
        Exclude({ types: ['Whitespace', 'Newline'] })
      ]
    }),
    input: 'x + y',
    value: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '+' },
      { type: 'Identifier', value: 'y' }
    ]
  }
])
