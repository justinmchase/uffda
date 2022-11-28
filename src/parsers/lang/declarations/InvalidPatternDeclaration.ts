import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import {
  DeclarationKind,
  IModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";

export const InvalidPatternDeclaration: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "InvalidPatternDeclaration",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Until,
          name: "InvalidPatternDeclaration",
          message:
            "A pattern declaration was expected and should be in the form of [A = B;]",
          pattern: {
            kind: PatternKind.Object,
            keys: {
              kind: { kind: PatternKind.Equal, value: "Token" },
              value: { kind: PatternKind.Equal, value: ";" },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => (undefined),
        },
      },
    },
  ],
};
