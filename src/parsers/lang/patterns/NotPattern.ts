import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { VariablePattern } from "./VariablePattern.ts";

export const NotPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: VariablePattern,
      moduleUrl: "./VariablePattern.ts",
      names: ["VariablePattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "NotPattern",
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
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "^" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "pattern",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangPatternKind.VariablePattern,
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ pattern }) => ({
                kind: LangPatternKind.NotPattern,
                pattern,
              }),
            },
          },
          {
            kind: PatternKind.Reference,
            name: LangPatternKind.VariablePattern,
          },
        ],
      },
    },
  ],
};
