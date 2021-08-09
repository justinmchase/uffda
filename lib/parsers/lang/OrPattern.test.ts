import { tests } from '../../pattern.test.ts'
import { OrPattern } from './OrPattern.ts'

tests('parsers.lang.orpattern', () => [
  {
    id: 'ORPATTERN00',
    description: 'can parse a reference expression',
    pattern: () => OrPattern,
    input: [
      { type: 'Identifier', value: 'x' },
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  },
  {
    id: 'ORPATTERN00',
    description: 'can parse a projection expression',
    pattern: () => OrPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '-' },
      { type: 'Token', value: '>' },
      { type: 'SpecialIdentifier', value: '$0' }
    ],
    value: {
      type: 'ProjectionPattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'x'
      },
      expression: {
        type: 'SpecialReferencePattern',
        value: '$0'
      }
    }
  },
  {
    id: 'ORPATTERN00',
    description: 'can parse two reference expressions',
    pattern: () => OrPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '|' },
      { type: 'Identifier', value: 'y' },
    ],
    value: {
      type: 'OrPattern',
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
    id: 'ORPATTERN00',
    description: 'can parse two then expressions',
    pattern: () => OrPattern,
    input: [
      { type: 'Identifier', value: 'w' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '|' },
      { type: 'Identifier', value: 'y' },
      { type: 'Identifier', value: 'z' },
    ],
    value: {
      type: 'OrPattern',
      left: {
        type: 'ThenPattern',
        left: {
          type: 'ReferencePattern',
          value: 'w'
        },
        right: {
          type: 'ReferencePattern',
          value: 'x'
        }
      },
      right: {
        type: 'ThenPattern',
        left: {
          type: 'ReferencePattern',
          value: 'y'
        },
        right: {
          type: 'ReferencePattern',
          value: 'z'
        }
      },
    }
  }
])
