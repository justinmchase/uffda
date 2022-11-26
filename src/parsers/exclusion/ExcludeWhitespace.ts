import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

/**
 * Removes objects from Tokenizer output based on the provided type names
 * Matches objects of the form:
 * `{ type: string }`
 */
export const ExcludeWhitespace: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ExcludeWhitespace",
      pattern: {
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
                    kind: {
                      kind: PatternKind.Includes,
                      values: ["Whitespace", "NewLine"],
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
      }
    }
  ]
};
