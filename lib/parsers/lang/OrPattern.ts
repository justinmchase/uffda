import { or, projection, variable, then, object, rule, equal } from '../../patterns/mod.ts'
import { ProjectionPattern } from './ProjectionPattern.ts'

export const OrPattern = rule({
  name: 'OrPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            variable({
              name: 'l',
              pattern: s => OrPattern(s)
            }),
            object({
              keys: {
                type: equal({ value: 'Token' }),
                value: equal({ value: '|' })
              }
            }),
            variable({
              name: 'r',
              pattern: s => ProjectionPattern(s)
            })
          ]
        }),
        expr: ({ l, r }) => ({
          type: 'OrPattern',
          left: l,
          right: r
        }),
      }),
      s => ProjectionPattern(s)
    ]
  })
})
