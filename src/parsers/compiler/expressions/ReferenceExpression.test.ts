import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.REFERENCE00",
    description: "a",
    pattern: () => ExpressionCompiler,
    input: "a",
    value: {
      kind: ExpressionKind.Reference,
      name: "a",
    },
  },
]);
