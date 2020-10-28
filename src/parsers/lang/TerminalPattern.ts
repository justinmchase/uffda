import { or, rule } from '../../patterns'
import { ReferencePattern } from './ReferencePattern'
import { StringPattern } from './StringPattern'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      s => ReferencePattern(s),
      s => StringPattern(s),
    ]
  })
})
