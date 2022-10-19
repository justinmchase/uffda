import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "INVOKE00",
    match: Match.Default(Scope.Default({
      globals: {
        fn: (a: number, b: number) => a + b,
      },
    })).setVariables({
      a: 7,
      b: 11,
    }),
    result: 18,
    expression: () => ({
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "fn",
      },
      arguments: [
        {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        {
          kind: ExpressionKind.Reference,
          name: "b",
        },
      ],
    }),
  },
  {
    id: "INVOKE01",
    match: Match.Default(Scope.Default({
      globals: {
        fn: () => "uffda",
      },
    })),
    result: "uffda",
    expression: () => ({
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "fn",
      },
      arguments: [],
    }),
  },

  {
    id: "INVOKE02",
    match: Match.Default(Scope.Default({
      globals: {
        fn: () => "one",
      },
    })).setVariables({
      fn: () => "two",
    }),
    result: "two",
    expression: () => ({
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "fn",
      },
      arguments: [],
    }),
  },
]);
