import { any, equal, object, projection, rule, variable } from '../../patterns'
import { PipelinePattern } from './PipelinePattern'

export const PatternExpression = rule({
  name: 'PatternExpression',
  pattern: PipelinePattern
})
