import { any, equal, object, projection, rule, variable } from '../../patterns'
import { OrPattern } from './OrPattern'

export const PatternExpression = rule({
  name: 'PatternExpression',
  pattern: OrPattern
})
