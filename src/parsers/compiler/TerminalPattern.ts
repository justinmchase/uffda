import { any, equal, object, or, projection, rule, variable } from '../../patterns'
import { StringPattern } from './StringPattern'
import { ReferencePattern } from './ReferencePattern'
import { SpecialReferencePattern } from './SpecialReferencePattern'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      StringPattern,
      ReferencePattern,
      SpecialReferencePattern,
    ]
  })
})
