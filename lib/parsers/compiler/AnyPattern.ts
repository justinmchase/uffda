import { any, equal, object, projection, rule } from '../../patterns/mod.ts'

export const AnyPattern = rule({
  name: 'AnyPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'AnyPattern' })
      }
    }),
    expr: () => any()
  })
})
