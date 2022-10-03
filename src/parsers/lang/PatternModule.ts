import { IRulePattern, Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { IImportDeclaration, LangModuleKind } from "./lang.pattern.ts";

export const PatternModule: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Variable,
          name: "imports",
          pattern: {
            kind: PatternKind.Slice,
            pattern: {
              kind: PatternKind.Or,
              patterns: [
                {
                  kind: PatternKind.Reference,
                  name: LangModuleKind.ImportDeclaration
                },
                {
                  kind: PatternKind.Reference,
                  name: LangModuleKind.InvalidImportDeclaration,
                }
              ]
            }
          }
        },
        {
          kind: PatternKind.Variable,
          name: "patterns",
          pattern: {
            kind: PatternKind.Slice,
            pattern: {
              kind: PatternKind.Or,
              patterns: [
                {
                  kind: PatternKind.Reference,
                  name: LangModuleKind.PatternDeclaration
                },
                {
                  kind: PatternKind.Reference,
                  name: LangModuleKind.InvalidPatternDeclaration
                }
              ]
            }
          }
        }
      ]
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ patterns, imports }) => ({
        kind: LangModuleKind.PatternModule,
        patterns: patterns.filter((p: Pattern) => p),
        imports: imports.filter((i: IImportDeclaration) => i)
      })
    }
  },
};
