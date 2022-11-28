import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";
import { SlicePattern } from "./SlicePattern.ts";

export const VariablePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: SlicePattern,
      moduleUrl: "./SlicePattern.ts",
      names: ["SlicePattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "VariablePattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
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
                    value: { kind: PatternKind.Equal, value: ":" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "pattern",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: "SlicePattern",
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ name, pattern }) => ({
                kind: LangPatternKind.VariablePattern,
                name,
                pattern,
              }),
            },
          },
          { kind: PatternKind.Reference, name: "SlicePattern" },
        ],
      },
    },
  ],
};
