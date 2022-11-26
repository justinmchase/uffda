import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

export const Whitespace: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Whitespace",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Slice,
          min: 1,
          pattern: {
            kind: PatternKind.RegExp,
            pattern: /^[^\S\r\n]$/,
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ _ }) => _.join(""),
        },
      }
    }
  ]
};
