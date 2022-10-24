import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.SUBTRACT00",
    pattern: () => ExpressionCompiler,
    input: "a - b",
    value: {
      kind: ExpressionKind.Subtract,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Reference,
        name: "b",
      },
    },
  },
]);
