import { tests } from '../../pattern.test.ts'
import { ObjectKeyPattern } from './ObjectKeyPattern.ts'

tests('parsers.lang.objectkey', () => [
  {
    id: 'OBJECTKEY00',
    description: 'x',
    pattern: () => ObjectKeyPattern,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ObjectKeyPattern',
      name: 'x',
    }
  },
  {
    id: 'OBJECTKEY01',
    description: 'x:y',
    pattern: () => ObjectKeyPattern,
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
  },
  {
    id: 'OBJECTKEY02',
    description: 'x:y = z',
    pattern: () => ObjectKeyPattern,
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
  },
  
  {
    id: 'OBJECTKEY03',
    description: 'x = y',
    pattern: () => ObjectKeyPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'y' }
    ],
    value: {
      type: 'ObjectKeyPattern',
      name: 'x',
      pattern: {
        type: 'ReferencePattern',
        value: 'y'
      }
    }
  }
])
