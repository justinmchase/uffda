import { any, equal, object, or, projection, slice } from '../../patterns'
import { includes } from '../../patterns/includes'

interface IExclusionArgs {
  types: string[]
}

/**
 * Removes or preserves Whitespace and Newline characters from Tokenizer output
 * @param args.significance Defaults to None. Determines which whitespace should be preserved or not
 */
export function Exclusion(args: IExclusionArgs) {
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
          any
        ]
      })
    }),
    expr: ({ _ }) => _.filter(n => n)
  })
}
