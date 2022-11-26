import {
  Pattern,
  PatternKind,
} from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { IImportDeclaration, LangModuleKind } from "./lang.pattern.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import {
  ImportDeclaration,
  InvalidImportDeclaration,
  PatternDeclaration,
  InvalidPatternDeclaration,
} from "./declarations/mod.ts";

export const PatternModule: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./declarations/ImportDeclaration.ts",
      module: ImportDeclaration,
      names: ["ImportDeclaration"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./declarations/InvalidImportDeclaration.ts",
      module: InvalidImportDeclaration,
      names: ["InvalidImportDeclaration"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./declarations/PatternDeclaration.ts",
      module: PatternDeclaration,
      names: ["PatternDeclaration"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./declarations/InvalidPatternDeclaration.ts",
      module: InvalidPatternDeclaration,
      names: ["InvalidPatternDeclaration"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternModule",
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
                      name: LangModuleKind.ImportDeclaration,
                    },
                    {
                      kind: PatternKind.Reference,
                      name: LangModuleKind.InvalidImportDeclaration,
                    },
                  ],
                },
              },
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
                      name: LangModuleKind.PatternDeclaration,
                    },
                    {
                      kind: PatternKind.Reference,
                      name: LangModuleKind.InvalidPatternDeclaration,
                    },
                  ],
                },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ patterns, imports }) => ({
            kind: LangModuleKind.PatternModule,
            patterns: patterns.filter((p: Pattern) => p),
            imports: imports.filter((i: IImportDeclaration) => i),
          }),
        },
      }
    }
  ]
};
