import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  ArrayElementExpression,
  ArrayExpression,
  ArraySpreadExpression,
  Expression,
} from "../../runtime/expressions/expression.ts";

export const Array: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: ["Token"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./primary.ts",
      names: ["Primary"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/spread.ts",
      names: ["SpreadMarker"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Array",
      default: true,
    },
  ],
  rules: [
    {
      name: "OpenBracket",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "[" },
      expression: { kind: ExpressionKind.Native, fn: () => "[" },
    },
    {
      name: "CloseBracket",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "]" },
      expression: { kind: ExpressionKind.Native, fn: () => "]" },
    },
    {
      name: "ArrayElement",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Token",
        args: ["Primary"],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): ArrayElementExpression => ({
          kind: ExpressionKind.ArrayElement,
          expression: _ as Expression,
        }),
      },
    },
    {
      name: "ArraySpread",
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
        fn: ({ expression }): ArraySpreadExpression => ({
          kind: ExpressionKind.ArraySpread,
          expression: expression as Expression,
        }),
      },
    },
    {
      name: "ArrayInitializer",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "ArraySpread",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "ArrayElement",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): ArrayElementExpression | ArraySpreadExpression => _,
      },
    },
    {
      name: "ArrayElements",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "ArrayInitializer",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): (ArrayElementExpression | ArraySpreadExpression)[] => _,
      },
    },
    {
      name: "Array",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["OpenBracket"],
          },
          {
            kind: PatternKind.Variable,
            name: "elements",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ArrayElements",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["CloseBracket"],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ elements }): ArrayExpression => ({
          kind: ExpressionKind.Array,
          expressions: elements.length > 0 ? elements[0] : [],
        }),
      },
    },
  ],
};

export default Array;
