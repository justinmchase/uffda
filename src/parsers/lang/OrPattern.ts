import { regexp, or, projection, variable, then, object, rule } from '../../patterns'
import { ProjectionPattern } from './ProjectionPattern'

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
                type: regexp({ pattern: /Token/ }),
                value: regexp({ pattern: /|/ })
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
