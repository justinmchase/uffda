import { any, equal, object, or, projection, rule, variable } from '../../patterns/mod.ts'

export const SpecialReferencePattern = rule({
  name: 'SpecialReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'SpecialReferencePattern' }),
        value: variable({
          name: 'value',
          pattern: any, // String
        })
      }
    }),
    expr: (vars) => (console.log('SPECIAL', vars.value, vars), vars[vars.value])
  })
})
