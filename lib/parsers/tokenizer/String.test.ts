import { tests } from '../../pattern.test.ts'
import { String } from './String.ts'

tests('parsers.tokenizer.stringpattern', () => [
  {
    id: 'STRING00',
    description: 'can parse empty single quote string',
    pattern: () => String,
    input: '\'\'',
    value: ''
  },
  {
    id: 'STRING01',
    description: 'can parse single quote string',
    pattern: () => String,
    input: '\'a\'',
    value: 'a',
  },
  {
    id: 'STRING02',
    description: 'can parse single quote string with multiple characters',
    pattern: () => String,
    input: '\'abc\'',
    value: 'abc',
  },
  {
    id: 'STRING03',
    description: 'can parse string with escaped single-quote',
    pattern: () => String,
    input: '\'abc\\\'xyz\'',
    value: 'abc\'xyz'
  }
])
