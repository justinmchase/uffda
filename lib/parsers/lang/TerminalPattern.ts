import { or, rule } from '../../patterns/mod.ts'
import { ReferencePattern } from './ReferencePattern.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'
import { StringPattern } from './StringPattern.ts'
import { ObjectPattern } from './ObjectPattern.ts'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      s => ObjectPattern(s),
      s => SpecialReferencePattern(s),
      s => ReferencePattern(s),
      s => StringPattern(s),
    ]
  })
})
