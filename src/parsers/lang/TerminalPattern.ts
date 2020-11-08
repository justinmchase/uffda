import { or, rule } from '../../patterns'
import { ReferencePattern } from './ReferencePattern'
import { SpecialReferencePattern } from './SpecialReferencePattern'
import { StringPattern } from './StringPattern'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      s => SpecialReferencePattern(s),
      s => ReferencePattern(s),
      s => StringPattern(s),
    ]
  })
})
