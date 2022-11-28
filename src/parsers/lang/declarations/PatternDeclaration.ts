import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangModuleKind, LangPatternKind } from "../lang.pattern.ts";
import {
  DeclarationKind,
  IModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";
import { PatternPattern } from "../patterns/PatternPattern.ts";

// PatternDeclaration
//   = { kind = 'Identifier', name:value = string }
//     { kind = 'Token',      value = '=' }
//     pattern:PatternPattern
//     { kind = 'Token',      value = ';' }
//   -> {
//     kind: 'PatternDeclaration',
//     name,
//     pattern
//   }
export const PatternDeclaration: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "../patterns/PatternPattern.ts",
      module: PatternPattern,
      names: ["PatternPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternDeclaration",
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
                  kind: PatternKind.Variable,
                  name: "name",
                  pattern: { kind: PatternKind.String },
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "=" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.PatternPattern,
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
          fn: ({ name, pattern }) => ({
            kind: LangModuleKind.PatternDeclaration,
            name,
            pattern,
          }),
        },
      },
    },
  ],
};
