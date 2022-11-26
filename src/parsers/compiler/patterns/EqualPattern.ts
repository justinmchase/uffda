import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";

export const EqualPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "EqualPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: LangPatternKind.EqualPattern },
            value: {
              kind: PatternKind.Variable,
              name: "value",
              pattern: { kind: PatternKind.Any },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ value }) => ({
            kind: PatternKind.Equal,
            value,
          }),
        },
      },
    }
  ]
};
