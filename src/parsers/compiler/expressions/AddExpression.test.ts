import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.ADD00",
    pattern: () => ExpressionCompiler,
    input: "a + b",
    value: {
      kind: ExpressionKind.Add,
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
