import { tests } from '../../pattern.test.ts'
import { PatternExpression } from './PatternExpression.ts'

tests('parsers.lang.patternexpression', () => [
  {
    id: 'PATTERNEXPR00',
    description: 'Can be a single reference',
    pattern: () => PatternExpression,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  },
  {
    id: 'PATTERNEXPR01',
    description: 'Can be a pipeline',
    pattern: () => PatternExpression,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '>' },
      { type: 'Identifier', value: 'y' },
    ],
    value: {
      type: 'PipelinePattern',
      left: { type: 'ReferencePattern', value: 'x' },
      right: { type: 'ReferencePattern', value: 'y' },
    }
  }
])