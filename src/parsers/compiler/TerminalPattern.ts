import { or, rule } from '../../patterns'
import { StringPattern } from './StringPattern'
import { ReferencePattern } from './ReferencePattern'
import { SpecialReferencePattern } from './SpecialReferencePattern'
import { OkPattern } from './OkPattern'
import { AnyPattern } from './AnyPattern'
import { ObjectPattern } from './ObjectPattern'

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
