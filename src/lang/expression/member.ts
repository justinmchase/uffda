import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  ArrayExpression,
  Expression,
  MemberExpression,
  ObjectExpression,
  PrimaryExpression,
  ReferenceExpression,
  TerminalExpression,
} from "../../runtime/expressions/expression.ts";

export const Member: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: ["Token"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./sequence.ts",
      names: ["Sequence"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./array.ts",
      names: ["Array"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./object.ts",
      names: ["Object"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./terminal.ts",
      names: ["Terminal"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./reference.ts",
      names: ["Reference"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Member",
      default: true,
    },
  ],
  rules: [
    {
      name: "MemberTarget",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Sequence"],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Array"],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Object"],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["Terminal"],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }:
          | ArrayExpression
          | ObjectExpression
          | PrimaryExpression
          | TerminalExpression) => _,
      },
    },
    {
      name: "MemberTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: ".",
          },
          {
            kind: PatternKind.Variable,
            name: "name",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Token",
              args: ["Reference"],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name }): ReferenceExpression => name as ReferenceExpression,
      },
    },
    {
      name: "Member",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "base",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Token",
              args: ["MemberTarget"],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "segments",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "MemberTail",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ base, segments }): MemberExpression => {
          let expression = base as Expression;
          for (const segment of segments as ReferenceExpression[]) {
            expression = {
              kind: ExpressionKind.Member,
              expression,
              name: segment.name,
            };
          }

          return expression as MemberExpression;
        },
      },
    },
  ],
};

export default Member;
