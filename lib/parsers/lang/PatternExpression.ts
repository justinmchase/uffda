import { rule } from '../../patterns/mod.ts'
import { PipelinePattern } from './PipelinePattern.ts'

export const PatternExpression = rule({
  name: 'PatternExpression',
  pattern: s => PipelinePattern(s)
})

