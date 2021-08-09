import { tests } from '../../pattern.test.ts'
import { PipelinePattern } from './PipelinePattern.ts'

tests('parsers.lang.pipeline', () => [
  {
    id: 'PIPELINE00',
    description: 'it can pipe two steps',
    pattern: () => s => PipelinePattern(s),
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '>' },
      { type: 'Identifier', value: 'y' }
    ],
    value: {
      type: 'PipelinePattern',
      left: {
        type: 'ReferencePattern',
        value: 'x'
      },
      right: {
        type: 'ReferencePattern',
        value: 'y'
      }
    }
  }
])
