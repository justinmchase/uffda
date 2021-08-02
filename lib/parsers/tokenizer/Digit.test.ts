import { tests } from '../../pattern.test.ts'
import { Digit } from './Digit.ts'

tests('parsers.tokenizer.digit', () => [
  {
    id: 'DIGIT00',
    description: 'matches a digit',
    pattern: () => Digit,
    input: '1',
    value: '1',
  },
  {
    id: 'DIGIT01',
    description: 'does not match a non-digit',
    pattern: () => Digit,
    input: '*',
    matched: false,
    done: false
  }
])