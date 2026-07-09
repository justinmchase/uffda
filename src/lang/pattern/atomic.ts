import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export const Atomic: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./atoms.ts",
      names: ["Atoms"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./literals.ts",
      names: ["Literals"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./resolve.ts",
      names: ["Resolve"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./structure.ts",
      names: ["Structure"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Atomic",
      default: true,
    },
  ],
  rules: [
    {
      name: "Atomic",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Atoms",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Literals",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Resolve",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Structure",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): Pattern => _ as Pattern,
      },
    },
  ],
};

export default Atomic;
