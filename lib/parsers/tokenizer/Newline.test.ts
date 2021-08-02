import { tests } from '../../pattern.test.ts'
import { Newline } from './Newline.ts'

tests('parsers.tokenizer.newline', () => [
  {
    id: 'NEWLINE00',
    description: 'can match slash n',
    pattern: () => Newline,
    input: '\n',
    value: '\n'
  },
  {
    id: 'NEWLINE01',
    description: 'can match slash r',
    pattern: () => Newline,
    input: '\r',
    value: '\r'
  },
  {
    id: 'NEWLINE02',
    description: 'can match slash r slash n',
    pattern: () => Newline,
    input: '\r\n',
    value: '\r\n'
  },
  {
    id: 'NEWLINE03',
    description: 'slash r slash n is two different new lines',
    pattern: () => Newline,
    input: '\n\r',
    value: '\n',
    done: false
  }
])
