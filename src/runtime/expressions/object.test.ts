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
          kind: ExpressionKind.ObjectKey,
          name: "x",
          expression: {
            kind: ExpressionKind.Value,
            value: 7,
          },
        },
        {
          kind: ExpressionKind.ObjectKey,
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
          kind: ExpressionKind.ObjectKey,
          name: "x",
          expression: {
            kind: ExpressionKind.Value,
            value: 7,
          },
        },
        {
          kind: ExpressionKind.ObjectKey,
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
  {
    id: "RUNTIME.OBJECT03",
    match: Match.Default(Scope.Default()),
    result: { x: 7, y: 11 },
    expression: () => ({
      kind: ExpressionKind.Object,
      keys: [
        {
          kind: ExpressionKind.ObjectSpread,
          expression: {
            kind: ExpressionKind.Value,
            value: { x: 7, y: 11 }
          }
        }
      ],
    }),
  },
  {
    id: "RUNTIME.OBJECT04",
    match: Match.Default(Scope.Default()),
    result: { x: 7, y: 13, z: 19 },
    expression: () => ({
      kind: ExpressionKind.Object,
      keys: [
        {
          kind: ExpressionKind.ObjectSpread,
          expression: {
            kind: ExpressionKind.Value,
            value: { x: 7, y: 11 }
          }
        },
        {
          kind: ExpressionKind.ObjectSpread,
          expression: {
            kind: ExpressionKind.Value,
            value: { y: 13, z: 19 }
          }
        },
      ],
    }),
  },
  {
    id: "RUNTIME.OBJECT05",
    match: Match.Default(Scope.Default()),
    result: { x: 13, y: 11, z: 19 },
    expression: () => ({
      kind: ExpressionKind.Object,
      keys: [
        {
          kind: ExpressionKind.ObjectSpread,
          expression: {
            kind: ExpressionKind.Value,
            value: { x: 7, y: 11 }
          }
        },
        {
          kind: ExpressionKind.ObjectKey,
          name: "x",
          expression: {
            kind: ExpressionKind.Value,
            value: 13
          }
        },
        {
          kind: ExpressionKind.ObjectSpread,
          expression: {
            kind: ExpressionKind.Value,
            value: { z: 19 }
          }
        }
      ],
    }),
  },
]);
