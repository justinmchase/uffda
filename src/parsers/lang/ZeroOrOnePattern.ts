import { or, projection, variable, then, object, rule, equal } from '../../patterns'
import { TerminalPattern } from './TerminalPattern'

export const ZeroOrOnePattern = rule({
  name: 'ZeroOrOnePattern',
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
            value: equal({ value: '?' })
          }
        })
      ]
    }),
    expr: ({ pattern }) => (console.log('ZEROORONE', pattern), {
      type: 'ZeroOrOnePattern',
      pattern
    }),
  })
})
