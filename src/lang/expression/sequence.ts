import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { InvocationExpression } from "../../runtime/expressions/expression.ts";

export const Sequence: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./primary.ts",
      names: [
        "Primary",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Sequence",
      default: true,
    },
  ],
  rules: [
    {
      name: "Sequence",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "(",
          },
          {
            kind: PatternKind.Variable,
            name: "p",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "Primary",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: ")",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ p }): InvocationExpression => {
          const [expression, ...args] = p;
          return {
            kind: ExpressionKind.Invocation,
            expression,
            args,
          };
        },
      },
    },
  ],
};

export default Sequence;
