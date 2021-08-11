import { tests } from '../../test.ts'
import { Letter } from './Letter.ts'

tests('parsers.tokenizer.letter', () => [
  {
    id: 'LETTER00',
    description: 'matches a letter',
    pattern: () => Letter,
    input: 'a',
    value: 'a',
  },
  {
    id: 'LETTER01',
    description: 'does not match a non-letter',
    pattern: () => Letter,
    input: '*',
    matched: false,
    done: false,
  },
  {
    id: 'LETTER02',
    description: 'does not match a digit',
    pattern: () => Letter,
    input: '1',
    matched: false,
    done: false
  }
])
