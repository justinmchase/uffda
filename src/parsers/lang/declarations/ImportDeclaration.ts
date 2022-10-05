import { IRulePattern, PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangModuleKind } from "../lang.pattern.ts";

// PatternDeclaration
//   = { kind = 'Identifier', value = 'import' }
//     { kind = 'Token',      value = '(' }
//     names:({ kind = 'Identifier', i:value = string } ','? -> i)+
//     { kind = 'Token',      value = ')' }
//     modulePath: ??
//     { kind = 'Token',      value = ';' }
//   -> {
//     kind: 'ImportDeclaration',
//     name,
//     pattern
//   }
export const ImportDeclaration: IRulePattern = {
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
            value: {
              kind: PatternKind.Equal,
              value: "import",
            },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "String" },
            value: {
              kind: PatternKind.Variable,
              name: "modulePath",
              pattern: { kind: PatternKind.Any },
            },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
            value: { kind: PatternKind.Equal, value: "(" },
          },
        },
        {
          kind: PatternKind.Variable,
          name: "names",
          pattern: {
            kind: PatternKind.Slice,
            min: 1,
            pattern: {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Object,
                keys: {
                  type: { kind: PatternKind.Equal, value: "Identifier" },
                  value: {
                    kind: PatternKind.Variable,
                    name: "i",
                    pattern: { kind: PatternKind.String },
                  },
                },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ i }) => i,
              },
            },
          },
        },
        {
          kind: PatternKind.Object,
          keys: {
            type: { kind: PatternKind.Equal, value: "Token" },
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
              type: { kind: PatternKind.Equal, value: "Token" },
              value: { kind: PatternKind.Equal, value: ";" },
            },
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ names, modulePath }) => ({
        kind: LangModuleKind.ImportDeclaration,
        names,
        modulePath,
      }),
    },
  },
};
