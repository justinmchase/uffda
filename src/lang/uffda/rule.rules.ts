import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Type } from "@justinmchase/type";
import type { UffdaRuleSyntaxDeclaration } from "./syntax.types.ts";

export const RuleDeclarationRules: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../pattern/pattern.lang.ts",
      names: ["PatternLang"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/expression.lang.ts",
      names: ["ExpressionLang"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./shared.rules.ts",
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
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "PatternLang",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RulePatternToken",
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
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "ExpressionLang",
        args: [],
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
        kind: PatternKind.Type,
        type: Type.String,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RulePatternTokenUntilSemicolon",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Not,
            pattern: {
              kind: PatternKind.Equal,
              value: ";",
            },
          },
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RulePatternTokenUntilProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Not,
            pattern: {
              kind: PatternKind.Equal,
              value: "-",
            },
          },
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RulePatternBodyWithoutProjection",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        max: 1,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "RulePatternTokenUntilSemicolon",
          args: [],
        },
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
        kind: PatternKind.Quantifier,
        min: 1,
        max: 1,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "RulePatternTokenUntilProjection",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "RuleDeclarationSyntax",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RuleDeclarationWithProjection",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "RuleDeclarationWithoutProjection",
            args: [],
          },
        ],
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
        fn: ({ name, pattern }): UffdaRuleSyntaxDeclaration => ({
          kind: "rule",
          name: name as string,
          pattern,
          projection: undefined,
        }),
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
        fn: ({ name, pattern, projection }): UffdaRuleSyntaxDeclaration => ({
          kind: "rule",
          name: name as string,
          pattern,
          projection,
        }),
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
              kind: PatternKind.Or,
              patterns: [
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RuleProjectionExpression",
                  args: [],
                },
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "RuleProjectionToken",
                  args: [],
                },
              ],
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
