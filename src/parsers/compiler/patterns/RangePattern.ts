import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const RangePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "RangePattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "RangePattern" },
            left: {
              kind: PatternKind.Variable,
              name: "left",
              pattern: { kind: PatternKind.Any },
            },
            right: {
              kind: PatternKind.Variable,
              name: "right",
              pattern: { kind: PatternKind.Any },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: PatternKind.Range,
            left,
            right,
          }),
        },
      },
    },
  ],
};
