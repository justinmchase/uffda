import { tests } from '../../pattern.test.ts'
import { ObjectKeyWithPattern } from './ObjectKeyWithPattern.ts'

tests('parsers.lang.objectkeywith', () => [
  {
    id: 'OBJECTKEYWITH00',
    description: 'can parse an object key with',
    pattern: () => ObjectKeyWithPattern,
    input: [
      { type: 'Identifier', value: 'test' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ObjectKeyPattern',
      name: 'test',
      pattern: {
        type: 'ReferencePattern',
        value: 'x'
      }
    }
  }
])
