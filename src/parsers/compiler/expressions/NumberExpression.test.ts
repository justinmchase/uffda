import { tests } from "../../../test.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.NUMBER00",
    pattern: () => ExpressionCompiler,
    input: "1",
    value: {
      kind: ExpressionKind.Value,
      value: 1,
    },
  },
  {
    id: "COMPILER.EXPRESSION.NUMBER01",
    pattern: () => ExpressionCompiler,
    input: "7 + 11",
    value: {
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Add,
      left: {
        kind: ExpressionKind.Value,
        value: 7,
      },
      right: {
        kind: ExpressionKind.Value,
        value: 11,
      },
    },
  },
]);
