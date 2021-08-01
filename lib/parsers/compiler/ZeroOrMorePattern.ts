import { any, equal, object, or, projection, rule, slice, then, variable } from '../../patterns/mod.ts'
import { TerminalPattern } from './TerminalPattern.ts'

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
