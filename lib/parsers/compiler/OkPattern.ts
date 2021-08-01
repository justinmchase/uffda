import { equal, object, ok, projection, rule } from '../../patterns/mod.ts'

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
