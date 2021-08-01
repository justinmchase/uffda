import { any, equal, object, projection, rule, variable } from '../../patterns/mod.ts'
import { PipelinePattern } from './PipelinePattern.ts'

export const PatternExpression = rule({
  name: 'PatternExpression',
  pattern: PipelinePattern
})
