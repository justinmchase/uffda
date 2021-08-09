import { tests } from '../../pattern.test.ts'
import { ObjectPattern } from './ObjectPattern.ts'

tests('parsers.lang.object', () => [
  {
    id: 'OBJECT00',
    description: 'can parse empty object',
    pattern: () => ObjectPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Token', value: '}' }
    ],
    value: {
      type: 'ObjectPattern',
      keys: []
    }
  },
  {
    id: 'OBJECT01',
    description: 'can parse an object with a key',
    pattern: () => ObjectPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '}' }
    ],
    value: {
      type: 'ObjectPattern',
      keys: [
        {
          type: 'ObjectKeyPattern',
          name: 'x'
        }
      ]
    }
  },
  {
    id: 'OBJECT02',
    description: 'can parse an object with a variable key',
    pattern: () => ObjectPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '}' }
    ],
    value: {
      type: 'ObjectPattern',
      keys: [
        {
          type: 'ObjectKeyPattern',
          alias: 'x',
          name: 'y',
        }
      ]
    }
  },
  {
    id: 'OBJECT03',
    description: 'can parse an object with a pattern key',
    pattern: () => ObjectPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'z' },
      { type: 'Token', value: '}' }
    ],
    value: {
      type: 'ObjectPattern',
      keys: [
        {
          type: 'ObjectKeyPattern',
          alias: 'x',
          name: 'y',
          pattern: {
            type: 'ReferencePattern',
            value: 'z'
          }
        }
      ]
    }
  },
  {
    id: 'OBJECT04',
    description: 'can parse an object with a pattern key',
    pattern: () => ObjectPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '}' }
    ],
    value: {
      type: 'ObjectPattern',
      keys: [
        {
          type: 'ObjectKeyPattern',
          name: 'x',
          pattern: {
            type: 'ReferencePattern',
            value: 'y'
          }
        }
      ]
    }
  },
  {
    id: 'OBJECT05',
    description: 'can parse an object with two pattern keys',
    pattern: () => ObjectPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'a' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'b' },
      { type: 'Token', value: ',' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '}' }
    ],
    value: {
      type: 'ObjectPattern',
      keys: [
        {
          type: 'ObjectKeyPattern',
          name: 'a',
          pattern: {
            type: 'ReferencePattern',
            value: 'b'
          }
        },
        {
          type: 'ObjectKeyPattern',
          name: 'x',
          pattern: {
            type: 'ReferencePattern',
            value: 'y'
          }
        }
      ]
    }
  }
])
