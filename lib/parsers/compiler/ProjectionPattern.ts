import { any, equal, object, or, projection, rule, variable } from '../../patterns/mod.ts'
import { ThenPattern } from './ThenPattern.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'

export const ProjectionPattern = rule({
  name: 'ProjectionPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: object({
          keys: {
            type: equal({ value: 'ProjectionPattern' }),
            pattern: variable({
              name: 'pattern',
              pattern: ThenPattern
            }),
            expression: variable({
              name: 'expression',
              pattern: SpecialReferencePattern,
            })
          }
        }),
        expr: ({ pattern, expression }) => (console.log('EXPR', pattern, expression), projection({ pattern, expr: expression }))
      }),
      ThenPattern
    ]
  })
})
