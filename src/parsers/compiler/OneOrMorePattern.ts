import { any, equal, object, or, projection, rule, slice, then, variable } from '../../patterns'
import { TerminalPattern } from './TerminalPattern'

export const OneOrMorePattern = rule({
  name: 'OneOrMorePattern',
  pattern: or({
    patterns: [
      projection({
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
      }),
      TerminalPattern
    ]
  })
})
