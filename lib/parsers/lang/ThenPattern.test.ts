import { tests } from '../../pattern.test.ts'
import { ThenPattern } from './ThenPattern.ts'

tests('.parsers.lang.ThenPattern', () => [
  {
    id: 'THEN00',
    description: 'can parse as a reference',
    pattern: () => ThenPattern,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  },
  {
    id: 'THEN01',
    description: 'can parse x then y references',
    pattern: () => ThenPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Identifier', value: 'y' },
    ],
    value: {
      type: 'ThenPattern',
      left: {
        type: 'ReferencePattern',
        value: 'x'
      },
      right: {
        type: 'ReferencePattern',
        value: 'y'
      }
    }
  },
  {
    id: 'THEN02',
    description: 'can parse variable string',
    pattern: () => ThenPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'String', value: 'abc' },
      { type: 'Identifier', value: 'y' },
    ],
    value: {
      type: 'ThenPattern',
      left: {
        type: 'VariablePattern',
        name: 'x',
        value: {
          type: 'StringPattern',
          value: 'abc'
        }
      },
      right: {
        type: 'ReferencePattern',
        value: 'y'
      }
    }
  }
])
