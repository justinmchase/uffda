import { or, rule } from '../../patterns/mod.ts'
import { StringPattern } from './StringPattern.ts'
import { ReferencePattern } from './ReferencePattern.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'
import { OkPattern } from './OkPattern.ts'
import { AnyPattern } from './AnyPattern.ts'
import { ObjectPattern } from './ObjectPattern.ts'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      ObjectPattern,
      AnyPattern,
      OkPattern,
      StringPattern,
      ReferencePattern,
      SpecialReferencePattern,
    ]
  })
})
