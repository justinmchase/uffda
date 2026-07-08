import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  ArrayExpression,
  BooleanExpression,
  MemberExpression,
  ObjectExpression,
  PrimaryExpression,
  TerminalExpression,
  ValueExpression,
} from "../../runtime/expressions/expression.ts";

export const Terminal: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./terminal.ts",
      names: [
        "Terminal",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./string.ts",
      names: [
        "String",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./array.ts",
      names: [
        "Array",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./object.ts",
      names: [
        "Object",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./member.ts",
      names: [
        "Member",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./boolean.ts",
      names: [
        "Boolean",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./nullish.ts",
      names: [
        "Nullish",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./sequence.ts",
      names: [
        "Sequence",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Primary",
      default: true,
    },
  ],
  rules: [
    {
      name: "Primary",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Sequence",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Array",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Object",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Member",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Boolean",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Nullish",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Terminal",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "String",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }):
          | ArrayExpression
          | BooleanExpression
          | MemberExpression
          | ObjectExpression
          | PrimaryExpression
          | TerminalExpression
          | ValueExpression => _,
      },
    },
  ],
};

export default Terminal;
