import { or, projection, variable, then, object, rule, equal } from '../../patterns/mod.ts'
import { TerminalPattern } from './TerminalPattern.ts'

export const ZeroOrMorePattern = rule({
  name: 'ZeroOrMorePattern',
  pattern: projection({
    pattern: then({
      patterns: [
        variable({
          name: 'pattern',
          pattern: TerminalPattern,
        }),
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: '*' })
          }
        })
      ]
    }),
    expr: ({ pattern }) => (console.log('ZEROORMORE', pattern), {
      type: 'ZeroOrMorePattern',
      pattern
    }),
  })
})
