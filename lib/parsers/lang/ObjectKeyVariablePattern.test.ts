import { tests } from '../../pattern.test.ts'
import { ObjectKeyVariablePattern } from './ObjectKeyVariablePattern.ts'

tests('parsers.lang.objectkeywith', () => [
  {
    id: 'OBJECTKEYVARWITH00',
    description: 'can parse an object key',
    pattern: () => ObjectKeyVariablePattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
    ],
    value: {
      type: 'ObjectKeyPattern',
      alias: 'x',
      name: 'y',
    }
  }
])
