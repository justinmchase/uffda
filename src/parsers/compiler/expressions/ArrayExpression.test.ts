import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ArrayExpression } from "./ArrayExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.ARRAY00",
    module: () => ArrayExpression,
    description: "[]",
    input: [
      {
        kind: LangExpressionKind.ArrayExpression,
        expressions: []
      }
    ],
    value: {
      kind: ExpressionKind.Array,
      expressions: [],
    },
  },
  {
    id: "COMPILER.EXPRESSION.ARRAY01",
    module: () => ArrayExpression,
    description: "[a b]",
    input: [
      {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [
          {
            kind: LangExpressionKind.ArrayElementExpression,
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "a"
            }
          },
          {
            kind: LangExpressionKind.ArrayElementExpression,
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "b"
            }
          }
        ]
      }
    ],
    value: {
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArrayElement,
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
        {
          kind: ExpressionKind.ArrayElement,
          expression: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        },
      ],
    },
  },
  {
    id: "COMPILER.EXPRESSION.ARRAY02",
    module: () => ArrayExpression,
    description: "[a ...b]",
    input: [
      {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [
          {
            kind: LangExpressionKind.ArrayElementExpression,
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "a"
            }
          },
          {
            kind: LangExpressionKind.ArraySpreadExpression,
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "b"
            }
          }
        ]
      }
    ],
    value: {
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArrayElement,
          expression: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
        },
        {
          kind: ExpressionKind.ArraySpread,
          expression: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        },
      ],
    },
  },
]);
