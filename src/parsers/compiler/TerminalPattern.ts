import { or, rule } from '../../patterns'
import { StringPattern } from './StringPattern'
import { ReferencePattern } from './ReferencePattern'
import { SpecialReferencePattern } from './SpecialReferencePattern'
import { OkPattern } from './OkPattern'
import { AnyPattern } from './AnyPattern'

export const TerminalPattern = rule({
  name: 'TerminalPattern',
  pattern: or({
    patterns: [
      AnyPattern,
      OkPattern,
      StringPattern,
      ReferencePattern,
      SpecialReferencePattern,
    ]
  })
})
