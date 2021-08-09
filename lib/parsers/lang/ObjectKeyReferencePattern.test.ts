import { tests } from '../../pattern.test.ts'
import { ObjectKeyReferencePattern } from './ObjectKeyReferencePattern.ts'

tests('parsers.lang.objectkeywith', () => [
  {
    id: 'OBJECTKEYREF00',
    description: 'can parse an object key',
    pattern: () => ObjectKeyReferencePattern,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ObjectKeyPattern',
      name: 'x',
    }
  }
])
