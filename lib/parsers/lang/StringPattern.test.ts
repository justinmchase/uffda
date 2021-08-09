import { tests } from '../../pattern.test.ts'
import { StringPattern } from './StringPattern.ts'

tests('parsers.lang.stringpattern', () => [
  {
    id: 'STRINGPATTERN00',
    description: 'Can parse strings',
    pattern: () => StringPattern,
    input: [{ type: 'String', value: "test" }],
    value: {
      type: 'StringPattern',
      value: 'test'
    }
  }
])
