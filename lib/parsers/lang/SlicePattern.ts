import { or, rule } from '../../patterns/mod.ts'
import { ZeroOrMorePattern } from './ZeroOrMorePattern.ts'
import { ZeroOrOnePattern } from './ZeroOrOnePattern.ts'
import { OneOrMorePattern } from './OneOrMorePattern.ts'
import { TerminalPattern } from './TerminalPattern.ts'

export const SlicePattern = rule({
  name: 'SlicePattern',
  pattern: or({
    patterns: [
      s => OneOrMorePattern(s),
      s => ZeroOrMorePattern(s),
      s => ZeroOrOnePattern(s),
      s => TerminalPattern(s),
    ]
  })
})
