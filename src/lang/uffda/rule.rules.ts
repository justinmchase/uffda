import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { Expression } from "../../runtime/expressions/expression.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Type } from "@justinmchase/type";
import type { UffdaRuleSyntaxDeclaration } from "./syntax.types.ts";

export const RuleDeclarationRules: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../pattern/pattern.lang.ts",
      names: ["PatternTokens"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/expression.lang.uff",
      names: ["ExpressionTokens"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./shared.rules.uff",
      names: ["IdentifierToken"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "RulePatternBody",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RuleProjectionExpression",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RulePatternToken",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RuleProjectionToken",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RulePatternTokenUntilSemicolon",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RulePatternTokenUntilProjection",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RulePatternBodyWithoutProjection",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RulePatternBodyBeforeProjection",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RuleDeclarationSyntax",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RuleDeclarationWithoutProjection",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RuleDeclarationWithProjection",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "RuleProjectionTail",
    },
  ],
  rules: [
    {
      name: "RulePatternBody",
      parameters: [],
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RulePatternToken",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "PatternTokens",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RuleProjectionExpression",
      parameters: [],
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RuleProjectionToken",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "ExpressionTokens",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RulePatternToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Type,
        type: Type.String,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RuleProjectionToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RuleQuotedTokenSequence",
              args: [],
            },
            {
              kind: PatternKind.And,
              patterns: [
                {
                  kind: PatternKind.Not,
                  pattern: { kind: PatternKind.Equal, value: ";" },
                },
                { kind: PatternKind.Type, type: Type.String },
              ],
            },
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => (_ as unknown[]).flat(),
      },
    },
    {
      name: "RuleQuotedTokenSequence",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: '"' },
          {
            kind: PatternKind.Variable,
            name: "content",
            pattern: {
              kind: PatternKind.Quantifier,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleQuotedTokenContent",
                args: [],
              },
            },
          },
          { kind: PatternKind.Equal, value: '"' },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ content }): unknown[] => [
          '"',
          ...(content as unknown[]).flat(),
          '"',
        ],
      },
    },
    {
      name: "RuleQuotedTokenContent",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RuleEscapedQuotedTokens",
            args: [],
          },
          {
            kind: PatternKind.And,
            patterns: [
              {
                kind: PatternKind.Not,
                pattern: { kind: PatternKind.Equal, value: '"' },
              },
              { kind: PatternKind.Type, type: Type.String },
            ],
          },
        ],
      },
    },
    {
      name: "RuleEscapedQuotedTokens",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: "\\" },
          {
            kind: PatternKind.Variable,
            name: "escaped",
            pattern: {
              kind: PatternKind.Or,
              patterns: [
                { kind: PatternKind.Equal, value: '"' },
                { kind: PatternKind.Equal, value: "{" },
              ],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ escaped }): unknown[] => ["\\", escaped],
      },
    },
    {
      name: "RulePatternTokenUntilSemicolon",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RuleQuotedTokenSequence",
              args: [],
            },
            {
              kind: PatternKind.And,
              patterns: [
                {
                  kind: PatternKind.Not,
                  pattern: { kind: PatternKind.Equal, value: ";" },
                },
                { kind: PatternKind.Type, type: Type.String },
              ],
            },
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => (_ as unknown[]).flat(),
      },
    },
    {
      name: "RulePatternChunkNested",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RuleQuotedTokenSequence",
            args: [],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "(" },
              {
                kind: PatternKind.Quantifier,
                min: 0,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RulePatternChunkNested",
                  args: [],
                },
              },
              { kind: PatternKind.Equal, value: ")" },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "[" },
              {
                kind: PatternKind.Quantifier,
                min: 0,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RulePatternChunkNested",
                  args: [],
                },
              },
              { kind: PatternKind.Equal, value: "]" },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "{" },
              {
                kind: PatternKind.Quantifier,
                min: 0,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RulePatternChunkNested",
                  args: [],
                },
              },
              { kind: PatternKind.Equal, value: "}" },
            ],
          },
          {
            kind: PatternKind.And,
            patterns: [
              {
                kind: PatternKind.Not,
                pattern: { kind: PatternKind.Equal, value: ")" },
              },
              {
                kind: PatternKind.Not,
                pattern: { kind: PatternKind.Equal, value: "]" },
              },
              {
                kind: PatternKind.Not,
                pattern: { kind: PatternKind.Equal, value: "}" },
              },
              { kind: PatternKind.Type, type: Type.String },
            ],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): unknown => {
          const value = _ as unknown;
          return Array.isArray(value)
            ? (value as unknown[]).flat(Infinity)
            : value;
        },
      },
    },
    {
      name: "RulePatternChunkAtDepth0",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RuleQuotedTokenSequence",
            args: [],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "(" },
              {
                kind: PatternKind.Quantifier,
                min: 0,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RulePatternChunkNested",
                  args: [],
                },
              },
              { kind: PatternKind.Equal, value: ")" },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "[" },
              {
                kind: PatternKind.Quantifier,
                min: 0,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RulePatternChunkNested",
                  args: [],
                },
              },
              { kind: PatternKind.Equal, value: "]" },
            ],
          },
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Equal, value: "{" },
              {
                kind: PatternKind.Quantifier,
                min: 0,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RulePatternChunkNested",
                  args: [],
                },
              },
              { kind: PatternKind.Equal, value: "}" },
            ],
          },
          {
            kind: PatternKind.And,
            patterns: [
              {
                kind: PatternKind.Not,
                pattern: { kind: PatternKind.Equal, value: ";" },
              },
              {
                kind: PatternKind.Not,
                pattern: {
                  kind: PatternKind.Then,
                  patterns: [
                    { kind: PatternKind.Equal, value: "-" },
                    { kind: PatternKind.Equal, value: ">" },
                  ],
                },
              },
              { kind: PatternKind.Type, type: Type.String },
            ],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): unknown => {
          const value = _ as unknown;
          return Array.isArray(value)
            ? (value as unknown[]).flat(Infinity)
            : value;
        },
      },
    },
    {
      name: "RulePatternTokenUntilProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "RulePatternChunkAtDepth0",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => (_ as unknown[]).flat(),
      },
    },
    {
      name: "RulePatternBodyWithoutProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RulePatternTokenUntilSemicolon",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "PatternTokens",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RulePatternBodyBeforeProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RulePatternTokenUntilProjection",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "PatternTokens",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RuleParameterName",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "IdentifierToken",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): { name: string } => ({ name: _ as string }),
      },
    },
    {
      name: "RuleParameterNameTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: ",",
          },
          {
            kind: PatternKind.Variable,
            name: "value",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RuleParameterName",
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
      name: "RuleParameterNameList",
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
              name: "RuleParameterName",
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
                name: "RuleParameterNameTail",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Variable,
            name: "trailing",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Equal,
                value: ",",
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ first, rest }) => [first, ...(rest as { name: string }[])],
      },
    },
    {
      name: "RuleParameterList",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "<",
          },
          {
            kind: PatternKind.Variable,
            name: "parameters",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleParameterNameList",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: ">",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ parameters }) =>
          Array.isArray(parameters) && parameters.length > 0
            ? parameters[0] as { name: string }[]
            : [],
      },
    },
    {
      name: "RuleDeclarationSyntax",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "rule",
          },
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
          {
            kind: PatternKind.Variable,
            name: "parameters",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleParameterList",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: "=",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RulePatternBodyBeforeProjection",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "projection",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleProjectionTail",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: ";",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (
          { name, parameters, pattern, projection },
        ): UffdaRuleSyntaxDeclaration => {
          const projections = projection as Expression[];
          const params = Array.isArray(parameters) && parameters.length > 0
            ? parameters[0] as { name: string }[]
            : [];
          return {
            kind: "rule",
            name: name as string,
            parameters: params,
            pattern,
            projection: projections.length > 0 ? projections[0] : undefined,
          };
        },
      },
    },
    {
      name: "RuleDeclarationWithoutProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "rule",
          },
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
          {
            kind: PatternKind.Variable,
            name: "parameters",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleParameterList",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: "=",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RulePatternBodyWithoutProjection",
              args: [],
            },
          },
          {
            kind: PatternKind.Equal,
            value: ";",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name, parameters, pattern }): UffdaRuleSyntaxDeclaration => {
          const params = Array.isArray(parameters) && parameters.length > 0
            ? parameters[0] as { name: string }[]
            : [];
          return {
            kind: "rule",
            name: name as string,
            parameters: params,
            pattern,
            projection: undefined,
          };
        },
      },
    },
    {
      name: "RuleDeclarationWithProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "rule",
          },
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
          {
            kind: PatternKind.Variable,
            name: "parameters",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              max: 1,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleParameterList",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: "=",
          },
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RulePatternBodyBeforeProjection",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "projection",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RuleProjectionTail",
              args: [],
            },
          },
          {
            kind: PatternKind.Equal,
            value: ";",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (
          { name, parameters, pattern, projection },
        ): UffdaRuleSyntaxDeclaration => {
          const params = Array.isArray(parameters) && parameters.length > 0
            ? parameters[0] as { name: string }[]
            : [];
          return {
            kind: "rule",
            name: name as string,
            parameters: params,
            pattern,
            projection,
          };
        },
      },
    },
    {
      name: "RuleProjectionTail",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "-",
          },
          {
            kind: PatternKind.Equal,
            value: ">",
          },
          {
            kind: PatternKind.Variable,
            name: "projection",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RuleProjectionExpression",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ projection }) => projection,
      },
    },
  ],
};

export default RuleDeclarationRules;
