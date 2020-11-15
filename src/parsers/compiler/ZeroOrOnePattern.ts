import { any, equal, object, or, projection, rule, slice, then, variable } from '../../patterns'
import { TerminalPattern } from './TerminalPattern'

export const ZeroOrOnePattern = rule({
  name: 'ZeroOrOnePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ZeroOrOnePattern' }),
        pattern: variable({
          name: 'pattern',
          pattern: TerminalPattern,
        })
      }
    }),
    expr: ({ pattern }) => (console.log('ZeroOrOne', { pattern }), slice({
      min: 0,
      max: 1,
      pattern
    }))
  })
})
