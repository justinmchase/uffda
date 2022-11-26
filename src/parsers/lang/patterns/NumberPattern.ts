import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";

// This matches number literals and turns them into equality matches for that number value
export const NumberPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "NumberPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "Integer" },
            value: {
              kind: PatternKind.Variable,
              name: "value",
              pattern: { kind: PatternKind.Number },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ value }) => ({
            kind: LangPatternKind.EqualPattern,
            value,
          }),
        },
      },
    }
  ]
};
