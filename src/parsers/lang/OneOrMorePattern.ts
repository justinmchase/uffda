import { or, projection, variable, then, object, rule, equal } from '../../patterns'
import { TerminalPattern } from './TerminalPattern'

export const OneOrMorePattern = rule({
  name: 'OneOrMorePattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            variable({
              name: 'pattern',
              pattern: s => TerminalPattern(s)
            }),
            object({
              keys: {
                type: equal({ value: 'Token' }),
                value: equal({ value: '+' })
              }
            })
          ]
        }),
        expr: ({ pattern }) => (console.log('ONEORMORE', pattern), {
          type: 'OneOrMorePattern',
          pattern
        }),
      }),
      s => TerminalPattern(s)
    ]
  })
})
