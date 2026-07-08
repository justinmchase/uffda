import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  Expression,
  ObjectExpression,
  ObjectKeyExpression,
  ObjectSpreadExpression,
} from "../../runtime/expressions/expression.ts";
import type { ReferenceExpression } from "../../runtime/expressions/mod.ts";

export const Object: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: ["Token"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./reference.ts",
      names: ["Reference"],
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
      name: "Object",
      default: true,
    },
  ],
  rules: [
    {
      name: "OpenBrace",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "{" },
      expression: { kind: ExpressionKind.Native, fn: () => "{" },
    },
    {
      name: "CloseBrace",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "}" },
      expression: { kind: ExpressionKind.Native, fn: () => "}" },
    },
    {
      name: "Colon",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: ":" },
      expression: { kind: ExpressionKind.Native, fn: () => ":" },
    },
    {
      name: "Comma",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "," },
      expression: { kind: ExpressionKind.Native, fn: () => "," },
    },
    {
      name: "ObjectPair",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "k",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Token",
              args: ["Reference"],
            },
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Colon"],
          },
          {
            kind: PatternKind.Variable,
            name: "v",
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
        fn: ({ k, v }): ObjectKeyExpression => ({
          kind: ExpressionKind.ObjectKey,
          name: (k as ReferenceExpression).name,
          expression: v as Expression,
        }),
      },
    },
    {
      name: "ObjectSpread",
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
        fn: ({ expression }): ObjectSpreadExpression => ({
          kind: ExpressionKind.ObjectSpread,
          expression: expression as Expression,
        }),
      },
    },
    {
      name: "ObjectEntry",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "ObjectSpread",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "ObjectPair",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): ObjectKeyExpression | ObjectSpreadExpression => _,
      },
    },
    {
      name: "ObjectPairTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Comma"],
          },
          {
            kind: PatternKind.Variable,
            name: "p",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ObjectEntry",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ p }): ObjectKeyExpression | ObjectSpreadExpression => p,
      },
    },
    {
      name: "ObjectPairs",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "first",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ObjectEntry",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "rest",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ObjectPairTail",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (
          { first, rest },
        ): (ObjectKeyExpression | ObjectSpreadExpression)[] => [first, ...rest],
      },
    },
    {
      name: "Object",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["OpenBrace"],
          },
          {
            kind: PatternKind.Variable,
            name: "keys",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ObjectPairs",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["CloseBrace"],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ keys }): ObjectExpression => ({
          kind: ExpressionKind.Object,
          keys: keys.length > 0 ? keys[0] : [],
        }),
      },
    },
  ],
};

export default Object;
