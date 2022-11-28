import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";

export const ObjectKeyVariablePattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ObjectKeyVariablePattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Variable,
                  name: "alias",
                  pattern: { kind: PatternKind.String },
                },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: ":" },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Identifier" },
                value: {
                  kind: PatternKind.Variable,
                  name: "name",
                  pattern: { kind: PatternKind.String },
                },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "must",
              pattern: {
                // must:'!'? -> !!_.length
                kind: PatternKind.Projection,
                pattern: {
                  kind: PatternKind.Slice,
                  min: 0,
                  max: 1,
                  pattern: {
                    kind: PatternKind.Object,
                    keys: {
                      kind: { kind: PatternKind.Equal, value: "Token" },
                      value: { kind: PatternKind.Equal, value: "!" },
                    },
                  },
                },
                expression: {
                  kind: ExpressionKind.Native,
                  fn: ({ _ }) => !!_.length,
                },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ alias, name, must }) => ({
            kind: LangPatternKind.ObjectKeyPattern,
            alias,
            name,
            must,
          }),
        },
      },
    },
  ],
};
