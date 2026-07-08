import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  Expression,
  InvocationExpression,
  InvocationSpreadExpression,
} from "../../runtime/expressions/expression.ts";

export const Sequence: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: [
        "Token",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./primary.ts",
      names: [
        "Primary",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/spread.ts",
      names: [
        "SpreadMarker",
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
      name: "OpenParen",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "(",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => "(",
      },
    },
    {
      name: "CloseParen",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: ")",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ")",
      },
    },
    {
      name: "InvocationSpread",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "SpreadMarker",
            args: [],
          },
          {
            kind: PatternKind.Variable,
            name: "expression",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Token",
              args: ["Primary"],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ expression }): InvocationSpreadExpression => ({
          kind: ExpressionKind.InvocationSpread,
          expression: expression as Expression,
        }),
      },
    },
    {
      name: "InvocationArgument",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "InvocationSpread",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Primary"],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): Expression | InvocationSpreadExpression => _,
      },
    },
    {
      name: "Sequence",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["OpenParen"],
          },
          {
            kind: PatternKind.Variable,
            name: "expression",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Token",
              args: ["Primary"],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "args",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "InvocationArgument",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["CloseParen"],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ expression, args }): InvocationExpression => ({
          kind: ExpressionKind.Invocation,
          expression,
          args,
        }),
      },
    },
  ],
};

export default Sequence;
