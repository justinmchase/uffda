import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.INVOCATION00",
    pattern: () => ExpressionCompiler,
    input: "(a)",
    value: {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      args: [],
    },
  },
  {
    id: "COMPILER.EXPRESSION.INVOCATION01",
    pattern: () => ExpressionCompiler,
    input: "(a b c)",
    value: {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      args: [
        {
          kind: ExpressionKind.Reference,
          name: "b",
        },
        {
          kind: ExpressionKind.Reference,
          name: "c",
        },
      ],
    },
  },
  {
    id: "COMPILER.EXPRESSION.INVOCATION02",
    pattern: () => ExpressionCompiler,
    input: "()",
    matched: false,
    done: false,
  },
]);
