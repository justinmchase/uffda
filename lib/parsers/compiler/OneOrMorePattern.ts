import { Pattern, equal, object, projection, rule, slice, variable } from '../../patterns/mod.ts'
import { TerminalPattern } from './TerminalPattern.ts'

export const OneOrMorePattern = rule({
  name: 'OneOrMorePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'OneOrMorePattern' }),
        pattern: variable({
          name: 'pattern',
          pattern: TerminalPattern,
        })
      }
    }),
    expr: ({ pattern }: { pattern: Pattern }) => (slice({
      min: 1,
      pattern
    }))
  })
})
