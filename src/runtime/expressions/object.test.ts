import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "RUNTIME.OBJECT00",
    match: Match.Default(Scope.Default()),
    result: { x: 7, y: 11 },
    expression: () => ({
      kind: ExpressionKind.Object,
      keys: [
        {
          name: "x",
          expression: {
            kind: ExpressionKind.Value,
            value: 7,
          },
        },
        {
          name: "y",
          expression: {
            kind: ExpressionKind.Value,
            value: 11,
          },
        },
      ],
    }),
  },
  {
    id: "RUNTIME.OBJECT01",
    match: Match.Default(Scope.Default()),
    result: { x: 11 },
    expression: () => ({
      kind: ExpressionKind.Object,
      keys: [
        {
          name: "x",
          expression: {
            kind: ExpressionKind.Value,
            value: 7,
          },
        },
        {
          name: "x",
          expression: {
            kind: ExpressionKind.Value,
            value: 11,
          },
        },
      ],
    }),
  },
  {
    id: "RUNTIME.OBJECT02",
    match: Match.Default(Scope.Default()),
    result: {},
    expression: () => ({
      kind: ExpressionKind.Object,
      keys: [],
    }),
  },
]);
