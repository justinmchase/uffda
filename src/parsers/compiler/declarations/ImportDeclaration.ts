import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { LangModuleKind } from "../../lang/lang.pattern.ts";

export const ImportDeclaration: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ImportDeclaration",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangModuleKind.ImportDeclaration,
            },
            moduleUrl: {
              kind: PatternKind.Variable,
              name: "moduleUrl",
              pattern: { kind: PatternKind.String },
            },
            names: {
              kind: PatternKind.Variable,
              name: "names",
              pattern: {
                kind: PatternKind.Array,
                pattern: {
                  kind: PatternKind.Slice,
                  pattern: {
                    kind: PatternKind.String,
                  },
                },
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ moduleUrl, names }) => ({
            kind: DeclarationKind.Import,
            moduleUrl,
            names,
          }),
        },
      },
    },
  ],
};
