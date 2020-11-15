import { or, rule } from '../../patterns'
import { OneOrMorePattern } from './OneOrMorePattern'
import { TerminalPattern } from './TerminalPattern'
import { ZeroOrMorePattern } from './ZeroOrMorePattern'
import { ZeroOrOnePattern } from './ZeroOrOnePattern'

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
