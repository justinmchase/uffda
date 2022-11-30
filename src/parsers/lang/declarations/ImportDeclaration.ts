import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangModuleKind } from "../lang.pattern.ts";
import {
  DeclarationKind,
  IModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";

// ImportDeclaration
//   = { kind = 'Identifier', value = 'import' }
//     { kind = 'Token',      value = '(' }
//     names:({ kind = 'Identifier', i:value = string } ','? -> i)+
//     { kind = 'Token',      value = ')' }
//     moduleUrl: ??
//     { kind = 'Token',      value = ';' }
//   -> {
//     kind: 'ImportDeclaration',
//     name,
//     pattern
//   }
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
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Equal,
                  value: "import",
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "String" },
                value: {
                  kind: PatternKind.Variable,
                  name: "moduleUrl",
                  pattern: { kind: PatternKind.String },
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "(" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "names",
              pattern: {
                kind: PatternKind.Slice,
                min: 0,
                pattern: {
                  kind: PatternKind.Projection,
                  pattern: {
                    kind: PatternKind.Object,
                    keys: {
                      kind: { kind: PatternKind.Equal, value: "Identifier" },
                      value: {
                        kind: PatternKind.Variable,
                        name: "name",
                        pattern: { kind: PatternKind.String },
                      },
                    },
                  },
                  expression: {
                    kind: ExpressionKind.Native,
                    fn: ({ name }) => name,
                  },
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: ")" },
              },
            },
            {
              kind: PatternKind.Must,
              name: "TokenExpected",
              message: "Expected token `;`",
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
          fn: ({ names, moduleUrl }) => ({
            kind: LangModuleKind.ImportDeclaration,
            names,
            moduleUrl,
          }),
        },
      },
    },
  ],
};
