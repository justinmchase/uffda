import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.ARRAY00",
    pattern: () => ExpressionCompiler,
    input: "[]",
    value: {
      kind: ExpressionKind.Array,
      expressions: [],
    },
  },
  {
    id: "COMPILER.EXPRESSION.ARRAY01",
    pattern: () => ExpressionCompiler,
    input: "[a b]",
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
    pattern: () => ExpressionCompiler,
    input: "[a ...b]",
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
