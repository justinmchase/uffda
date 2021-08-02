import { any, object, or, projection, slice, includes } from '../../patterns/mod.ts'

interface IExclusionArgs {
  types: string[]
}

/**
 * Removes objects from Tokenizer output based on the provided type names
 * Matches objects of the form:
 * `{ type: string }`
 */
export function Exclude(args: IExclusionArgs) {
  const { types } = args
  return projection({
    pattern: slice({
      pattern: or({
        patterns: [
          projection({
            pattern: object({
              keys: {
                type: includes({ values: types })
              }
            }),
            expr: () => undefined
          }),
          any()
        ]
      })
    }),
    expr: ({ _ }: { _: string[] }) => _.filter(n => n)
  })
}
