import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";
import { lit, ResolveTargetKind } from "../../runtime/patterns/pattern.ts";

export const Resolve: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.uff",
      names: ["Identifier"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./pattern.uff",
      names: ["Pattern"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Resolve",
      default: true,
    },
  ],
  rules: [
    {
      name: "ReservedKeyword",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: lit("and") },
          { kind: PatternKind.Equal, value: lit("any") },
          { kind: PatternKind.Equal, value: lit("array") },
          { kind: PatternKind.Equal, value: lit("bigint") },
          { kind: PatternKind.Equal, value: lit("boolean") },
          { kind: PatternKind.Equal, value: lit("date") },
          { kind: PatternKind.Equal, value: lit("end") },
          { kind: PatternKind.Equal, value: lit("error") },
          { kind: PatternKind.Equal, value: lit("except") },
          { kind: PatternKind.Equal, value: lit("fail") },
          { kind: PatternKind.Equal, value: lit("false") },
          { kind: PatternKind.Equal, value: lit("function") },
          { kind: PatternKind.Equal, value: lit("in") },
          { kind: PatternKind.Equal, value: lit("includes") },
          { kind: PatternKind.Equal, value: lit("into") },
          { kind: PatternKind.Equal, value: lit("lookahead") },
          { kind: PatternKind.Equal, value: lit("map") },
          { kind: PatternKind.Equal, value: lit("maybe") },
          { kind: PatternKind.Equal, value: lit("not") },
          { kind: PatternKind.Equal, value: lit("null") },
          { kind: PatternKind.Equal, value: lit("number") },
          { kind: PatternKind.Equal, value: lit("object") },
          { kind: PatternKind.Equal, value: lit("ok") },
          { kind: PatternKind.Equal, value: lit("or") },
          { kind: PatternKind.Equal, value: lit("over") },
          { kind: PatternKind.Equal, value: lit("pipeline") },
          { kind: PatternKind.Equal, value: lit("quantifier") },
          { kind: PatternKind.Equal, value: lit("set") },
          { kind: PatternKind.Equal, value: lit("string") },
          { kind: PatternKind.Equal, value: lit("symbol") },
          { kind: PatternKind.Equal, value: lit("true") },
          { kind: PatternKind.Equal, value: lit("undefined") },
          { kind: PatternKind.Equal, value: lit("variable") },
        ],
      },
    },
    {
      name: "IdentifierToken",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Identifier",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _ as string,
      },
    },
    {
      name: "ResolveName",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapedIdentifierToken",
            args: [],
          },
          {
            kind: PatternKind.And,
            patterns: [
              {
                kind: PatternKind.Not,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "ReservedKeyword",
                  args: [],
                },
              },
              {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "IdentifierToken",
                args: [],
              },
            ],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _ as string,
      },
    },
    {
      name: "EscapedIdentifierToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("@") },
          {
            kind: PatternKind.Variable,
            name: "name",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "IdentifierToken",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name }) => name as string,
      },
    },
    {
      name: "ResolveArg",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Pattern",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _ as Pattern,
      },
    },
    {
      name: "ResolveArgTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: lit(","),
          },
          {
            kind: PatternKind.Variable,
            name: "value",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ResolveArg",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ value }) => value,
      },
    },
    {
      name: "ResolveArgList",
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
              name: "ResolveArg",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "rest",
            pattern: {
              kind: PatternKind.Quantifier,
              min: lit(0),
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ResolveArgTail",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Variable,
            name: "trailing",
            pattern: {
              kind: PatternKind.Quantifier,
              min: lit(0),
              max: lit(1),
              pattern: {
                kind: PatternKind.Equal,
                value: lit(","),
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ first, rest }) => [first, ...(rest as Pattern[])],
      },
    },
    {
      name: "ResolveArgs",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("<") },
          {
            kind: PatternKind.Variable,
            name: "args",
            pattern: {
              kind: PatternKind.Quantifier,
              min: lit(0),
              max: lit(1),
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ResolveArgList",
                args: [],
              },
            },
          },
          { kind: PatternKind.Equal, value: lit(">") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ args }) =>
          Array.isArray(args) && args.length > 0 ? args[0] as Pattern[] : [],
      },
    },
    {
      name: "Resolve",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "name",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ResolveName",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "args",
            pattern: {
              kind: PatternKind.Quantifier,
              min: lit(0),
              max: lit(1),
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ResolveArgs",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name, args }) => ({
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name,
          args: Array.isArray(args) && args.length > 0 ? args[0] : [],
        }),
      },
    },
  ],
};

export default Resolve;
