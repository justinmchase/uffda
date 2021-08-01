import { any, equal, object, or, projection, rule, slice, then, variable } from '../../patterns/mod.ts'
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
    expr: ({ pattern }) => (console.log('OneOrMore', { pattern }), slice({
      min: 1,
      pattern
    }))
  })
})
