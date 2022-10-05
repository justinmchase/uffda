import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";

export const InvalidImportDeclaration: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Identifier" },
            value: { kind: PatternKind.Equal, value: "import" },
          },
        },
        {
          kind: PatternKind.Until,
          name: "InvalidImportDeclaration",
          message:
            "Expected an import to be in the form [import './file.uff' (Name);]",
          pattern: {
            kind: PatternKind.Object,
            keys: {
              type: { kind: PatternKind.Equal, value: "Token" },
              value: { kind: PatternKind.Equal, value: ";" },
            },
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: () => undefined,
    },
  },
};
