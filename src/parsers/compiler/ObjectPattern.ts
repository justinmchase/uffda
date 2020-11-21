import { any, equal, object, ok, or, projection, reference, rule, variable } from '../../patterns'

export const ObjectKeyPattern = rule({
  name: 'ObjectKeyPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ObjectKeyPattern' }),
        name: variable({
          name: 'name',
          pattern: any // String
        }),
        pattern: variable({
          name: 'pattern',
          pattern: or({
            patterns: [
              any,
              ok
            ]
          })
        })
      }
    }),
    expr: ({ name, pattern = any }) => ({ [name]: pattern })
  })
})

export const ObjectPattern = rule({
  name: 'ObjectPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ObjectPattern' }),
        keys: variable({
          name: 'keys',
          pattern: ObjectKeyPattern
        })
      }
    }),
    expr: ({ keys }) => (console.log('OBJECT', keys), object({ keys: Object.assign(keys) }))
  })
})
