import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import {
  DeclarationKind,
  IModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";

export const InvalidImportDeclaration: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "InvalidImportDeclaration",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
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
                  kind: { kind: PatternKind.Equal, value: "Token" },
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
    },
  ],
};
