import { or, rule } from '../../patterns'
import { ReferencePattern } from './ReferencePattern'
import { SpecialReferencePattern } from './SpecialReferencePattern'
import { StringPattern } from './StringPattern'
import { ObjectPattern } from './ObjectPattern'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      ObjectPattern,
      SpecialReferencePattern,
      ReferencePattern,
      StringPattern,
    ]
  })
})
