import { any, regexp, projection, variable, object, rule, equal, then, slice, or } from '../../patterns'
import { PatternExpression } from './PatternExpression'

export const ObjectKeyReference = rule({
  name: 'ObjectKeyReference',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'Identifier' }),
        value: variable({
          name: 'name',
          pattern: any
        })
      }
    }),
    expr: ({ name }) => ({
      type: 'ObjectKeyPattern',
      name
    })
  })
})

export const ObjectKeyWithPattern = rule({
  name: 'ObjectKeyWithPattern',
  pattern: projection({
    pattern: then({
      patterns: [
        object({
          keys: {
            type: equal({ value: 'Identifier' }),
            value: variable({
              name: 'name',
              pattern: any
            })
          }
        }),
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: '=' })
          }
        }),
        variable({
          name: 'pattern',
          pattern: s => PatternExpression(s)
        })
      ]
    }),
    expr: ({ name, pattern }) => ({
      type: 'ObjectKeyPattern',
      name,
      pattern
    })
  })
})

export const ObjectKeyPattern = rule({
  name: 'ObjectKeyPattern',
  pattern: or({
    patterns: [
      ObjectKeyWithPattern,
      ObjectKeyReference
    ]
  })
})

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
        // keys:(ObjectKeyPattern (',' k:ObjectKeyPattern -> k)*)?
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
                })
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
