import { tests } from '../../test.ts'
import { NewLine } from './NewLine.ts'

tests('parsers.tokenizer.newline', () => [
  {
    id: 'NEWLINE00',
    description: 'can match slash n',
    pattern: () => NewLine,
    input: '\n',
    value: '\n'
  },
  {
    id: 'NEWLINE01',
    description: 'can match slash r',
    pattern: () => NewLine,
    input: '\r',
    value: '\n'
  },
  {
    id: 'NEWLINE02',
    description: 'can match slash r slash n',
    pattern: () => NewLine,
    input: '\r\n',
    value: '\n'
  },
  {
    id: 'NEWLINE03',
    description: 'slash r slash n is two different new lines',
    pattern: () => NewLine,
    input: '\n\r',
    value: '\n',
    done: false
  }
])
