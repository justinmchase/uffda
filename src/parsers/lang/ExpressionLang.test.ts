import { tests } from "../../test.ts";
import { LangExpressionKind } from "./lang.pattern.ts";
import { ExpressionLang } from "./ExpressionLang.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { TokenizerKind } from "../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";

tests(() => [
  {
    id: "EXPRESSIONLANG00",
    module: () => ExpressionLang,
    input: "1 + 2",
    value: {
      kind: LangExpressionKind.AddExpression,
      left: { kind: LangExpressionKind.NumberExpression, value: 1 },
      right: { kind: LangExpressionKind.NumberExpression, value: 2 },
    },
  },
  {
    id: "EXPRESSIONLANG01",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [
        {
          kind: DeclarationKind.NativeImport,
          module: () => ExpressionLang,
          moduleUrl: "./ExpressionLang.ts",
          names: ["ExpressionLang"],
        },
      ],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "Test",
          pattern: {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: TokenizerKind.String },
                value: {
                  kind: PatternKind.Array,
                  pattern: {
                    kind: PatternKind.Variable,
                    name: "expression",
                    pattern: {
                      kind: PatternKind.Reference,
                      name: "ExpressionLang",
                    },
                  },
                },
              },
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ expression }) => expression,
            },
          },
        },
      ],
    }),
    input: [
      { kind: TokenizerKind.String, value: "7 + 11" },
    ],
    value: {
      kind: LangExpressionKind.AddExpression,
      left: {
        kind: LangExpressionKind.NumberExpression,
        value: 7,
      },
      right: {
        kind: LangExpressionKind.NumberExpression,
        value: 11,
      },
    },
  },
]);
