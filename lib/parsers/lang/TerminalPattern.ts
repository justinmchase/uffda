import { or, rule } from '../../patterns/mod.ts'
import { ReferencePattern } from './ReferencePattern.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'
import { StringPattern } from './StringPattern.ts'
import { ObjectPattern } from './ObjectPattern.ts'

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
