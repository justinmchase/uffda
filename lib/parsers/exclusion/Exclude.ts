import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";

interface IExclusionArgs {
  types: string[];
}

/**
 * Removes objects from Tokenizer output based on the provided type names
 * Matches objects of the form:
 * `{ type: string }`
 */
export function Exclude(args: IExclusionArgs): Pattern {
  const { types } = args;
  return {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Slice,
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Object,
              keys: {
                type: {
                  kind: PatternKind.Includes,
                  values: types,
                },
              },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: () => undefined,
            },
          },
          { kind: PatternKind.Any },
        ],
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ _ }) => _.filter((n: unknown) => n),
    },
  };
}
