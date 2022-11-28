import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";

// This matches quoted string literals "abc" and turns them into equality matches for that string literal
export const TypePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "TypePattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Equal,
                  value: "string",
                },
              },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: () => ({
                kind: LangPatternKind.StringPattern,
              }),
            },
          },
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Equal,
                  value: "boolean",
                },
              },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: () => ({
                kind: LangPatternKind.BooleanPattern,
              }),
            },
          },
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Equal,
                  value: "number",
                },
              },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: () => ({
                kind: LangPatternKind.NumberPattern,
              }),
            },
          },
        ],
      },
    },
  ],
};
