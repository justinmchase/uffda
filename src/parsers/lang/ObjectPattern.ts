import { any, regexp, projection, variable, object, rule, equal, then, slice, or } from '../../patterns'
import { ObjectKeyPattern } from './ObjectKeyPattern'

export const ObjectPattern = rule({
  name: 'ObjectPattern',
  pattern: projection({
    pattern: then({
      patterns: [
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: '{' }),
          }
        }),
        // keys:(ObjectKeyPattern (',' k:ObjectKeyPattern -> k)*)? ','?
        variable({
          name: 'keys',
          pattern: slice({
            min: 0,
            max: 1,
            pattern: then({
              patterns: [
                s => ObjectKeyPattern(s),
                slice({
                  min: 0,
                  pattern: projection({
                    pattern: then({
                      patterns: [
                        object({
                          keys: {
                            type: equal({ value: 'Token' }),
                            value: equal({ value: ',' })
                          }
                        }),
                        variable({
                          name: 'k',
                          pattern: s => ObjectKeyPattern(s)
                        }),
                      ]
                    }),
                    expr: ({ k }) => k
                  }),
                }),
                // Optional trailing comma
                slice({
                  min: 0,
                  max: 0,
                  pattern: object({
                    keys: {
                      type: equal({ value: 'Token' }),
                      value: equal({ value: ',' })
                    }
                  })
                }),
              ]
            })
          })
        }),
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: '}' }),
          }
        }),
      ]
    }),
    expr: ({ keys: k, keys: [[k0 = undefined, k1 = []] = []] = [], _ }) => ({
      type: 'ObjectPattern',
      keys: [k0, ...k1].filter(k => k)
    })
  })
})
