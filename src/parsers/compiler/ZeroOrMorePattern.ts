import { any, equal, object, or, projection, rule, slice, then, variable } from '../../patterns'
import { TerminalPattern } from './TerminalPattern'

export const ZeroOrMorePattern = rule({
  name: 'ZeroOrMorePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ZeroOrMorePattern' }),
        pattern: variable({
          name: 'pattern',
          pattern: TerminalPattern,
        })
      }
    }),
    expr: ({ pattern }) => (console.log('ZeroOrMore', { pattern }), slice({
      min: 0,
      pattern
    }))
  })
})
