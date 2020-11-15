import { or, rule } from '../../patterns'
import { ZeroOrMorePattern } from './ZeroOrMorePattern'
import { ZeroOrOnePattern } from './ZeroOrOnePattern'
import { OneOrMorePattern } from './OneOrMorePattern'
import { TerminalPattern } from './TerminalPattern'

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
