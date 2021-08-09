import { projection, variable, then, object, rule, equal } from '../../patterns/mod.ts'
import { TerminalPattern } from './TerminalPattern.ts'

export const OneOrMorePattern = rule({
  name: 'OneOrMorePattern',
  pattern: projection({
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
    expr: ({ pattern }) => ({
      type: 'OneOrMorePattern',
      pattern
    })
  })
})
