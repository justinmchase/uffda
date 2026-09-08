import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { Expression } from "../../runtime/expressions/expression.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export const Projection: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./pipe.uff",
      names: ["Pipe"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/expression.uff",
      names: ["Expression"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Projection",
      default: true,
    },
  ],
  rules: [
    {
      name: "ProjectionTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: "-" },
          { kind: PatternKind.Equal, value: ">" },
          {
            kind: PatternKind.Variable,
            name: "expression",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Expression",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ expression }): Expression => expression as Expression,
      },
    },
    {
      name: "Projection",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Pipe",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "tail",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ProjectionTail",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ pattern, tail }): Pattern => {
          const expression = (tail as Expression[])[0];
          if (!expression) {
            return pattern as Pattern;
          }
          return {
            kind: PatternKind.Projection,
            pattern: pattern as Pattern,
            expression,
          };
        },
      },
    },
  ],
};

export default Projection;
