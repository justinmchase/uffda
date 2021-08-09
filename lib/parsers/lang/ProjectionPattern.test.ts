import { tests } from '../../pattern.test.ts'
import { ProjectionPattern } from './ProjectionPattern.ts'

tests('parsers.lang.projectionpattern', () => [
  {
    id: 'PROJECT00',
    description: 'can parse a projection',
    pattern: () => ProjectionPattern,
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
    id: 'PROJECT01',
    description: 'can parse a variable',
    pattern: () => ProjectionPattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '-' },
      { type: 'Token', value: '>' },
      { type: 'SpecialIdentifier', value: '$0' }
    ],
    value: {
      type: 'ProjectionPattern',
      pattern: {
        type: 'VariablePattern',
        name: 'x',
        value: {
          type: 'ReferencePattern',
          value: 'y'
        }
      },
      expression: {
        type: 'SpecialReferencePattern',
        value: '$0'
      }
    }
  }
])
