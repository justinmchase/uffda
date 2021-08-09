import { tests } from '../../pattern.test.ts'
import { ObjectKeyVariableWithPattern } from './ObjectKeyVariableWithPattern.ts'

tests('parsers.lang.objectkeyvariablewith', () => [
  {
    id: 'OBJECTKEYVARWITH00',
    description: 'x:y = z',
    pattern: () => ObjectKeyVariableWithPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'z' }
    ],
    value: {
      type: 'ObjectKeyPattern',
      alias: 'x',
      name: 'y',
      pattern: {
        type: 'ReferencePattern',
        value: 'z'
      }
    }
  }
])
