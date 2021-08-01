import { or, rule } from '../../patterns/mod.ts'
import { OneOrMorePattern } from './OneOrMorePattern.ts'
import { TerminalPattern } from './TerminalPattern.ts'
import { ZeroOrMorePattern } from './ZeroOrMorePattern.ts'
import { ZeroOrOnePattern } from './ZeroOrOnePattern.ts'

export const SlicePattern = rule({
  name: 'SlicePattern',
  pattern: or({
    patterns: [
      OneOrMorePattern,
      ZeroOrMorePattern,
      ZeroOrOnePattern,
      TerminalPattern,
    ]
  })
})
