import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { ThenPattern } from "./ThenPattern.ts";
import { ExpressionPattern } from "./ExpressionPattern.ts";

export const ProjectionPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: ThenPattern,
      moduleUrl: "./ThenPattern.ts",
      names: ["ThenPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ExpressionPattern,
      moduleUrl: "./ExpressionPattern.ts",
      names: ["ExpressionPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ProjectionPattern",
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
                    value: { kind: PatternKind.Equal, value: "(" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "pattern",
                  pattern: { kind: PatternKind.Reference, name: "ThenPattern" },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: "-" },
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: ">" },
                  },
                },
                {
                  kind: PatternKind.Variable,
                  name: "expression",
                  pattern: {
                    kind: PatternKind.Reference,
                    name: LangPatternKind.ExpressionPattern,
                  },
                },
                {
                  kind: PatternKind.Object,
                  keys: {
                    kind: { kind: PatternKind.Equal, value: "Token" },
                    value: { kind: PatternKind.Equal, value: ")" },
                  },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ pattern, expression }) => ({
                kind: LangPatternKind.ProjectionPattern,
                pattern,
                expression,
              }),
            },
          },
          { kind: PatternKind.Reference, name: "ThenPattern" },
        ],
      },
    },
  ],
};
