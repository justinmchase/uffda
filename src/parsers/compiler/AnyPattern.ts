import { any, equal, object, ok, or, projection, reference, rule, variable } from '../../patterns'

export const AnyPattern = rule({
  name: 'AnyPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'AnyPattern' })
      }
    }),
    expr: () => (console.log('ANY'), any)
  })
})
