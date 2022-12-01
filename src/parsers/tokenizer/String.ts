import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

// StringPattern
//   = '\'' value:(('\\' '\'') -> '\'' | any)* '\'' -> s.join('')
export const String: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "String",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Equal, value: "'" },
            {
              kind: PatternKind.Variable,
              name: "value",
              pattern: {
                kind: PatternKind.Slice,
                pattern: {
                  kind: PatternKind.Or,
                  patterns: [
                    {
                      kind: PatternKind.Projection,
                      pattern: {
                        kind: PatternKind.Then,
                        patterns: [
                          { kind: PatternKind.Equal, value: "\\" },
                          { kind: PatternKind.Equal, value: "'" },
                        ],
                      },
                      expression: {
                        kind: ExpressionKind.Native,
                        fn: () => "'"
                      },
                    },
                    {
                      kind: PatternKind.Projection,
                      pattern: {
                        kind: PatternKind.Then,
                        patterns: [
                          { kind: PatternKind.Equal, value: "\\" },
                          {
                            kind: PatternKind.Variable,
                            name: "value",
                            pattern: { kind: PatternKind.String }
                          },
                        ],
                      },
                      expression: {
                        kind: ExpressionKind.Native,
                        fn: ({ value }) => JSON.parse(`"\\${value}"`)
                      },
                    },
                    {
                      kind: PatternKind.Projection,
                      pattern: {
                        kind: PatternKind.Then,
                        patterns: [
                          {
                            kind: PatternKind.Not,
                            pattern: { kind: PatternKind.Equal, value: "'" },
                          },
                          {
                            kind: PatternKind.Variable,
                            name: "value",
                            pattern: { kind: PatternKind.String },
                          },
                        ],
                      },
                      expression: {
                        kind: ExpressionKind.Native,
                        fn: ({ value }) => value,
                      },
                    },
                  ],
                },
              },
            },
            { kind: PatternKind.Equal, value: "'" },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ value }) => value.join(""),
        },
      },
    },
  ],
};
