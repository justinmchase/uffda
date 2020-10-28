import { rule } from '../../patterns'
import { OrPattern } from './OrPattern'

export const PatternExpression = rule({
  name: 'PatternExpression',
  pattern: s => OrPattern(s)
})

