import { any, equal, object, ok, or, projection, reference, rule, variable } from '../../patterns'

export const OkPattern = rule({
  name: 'OkPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'OkPattern' })
      }
    }),
    expr: () => (console.log('OK'), ok)
  })
})
