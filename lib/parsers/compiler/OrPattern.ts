import { any, equal, object, or, projection, rule, variable } from '../../patterns/mod.ts'
import { ProjectionPattern } from './ProjectionPattern.ts'

export const OrPattern = rule({
  name: 'OrPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: object({
          keys: {
            type: equal({ value: 'OrPattern' }),
            left: variable({
              name: 'left',
              pattern: s => OrPattern(s)
            }),
            right: variable({
              name: 'right',
              pattern: ProjectionPattern,
            })
          }
        }),
        expr: ({ left, right }) => (console.log('OR PATTERN', left, right), or({ patterns: [left, right] }))
      }),
      ProjectionPattern
    ]
  })
})
