import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { expressionTest } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

await Deno.test("runtime/expressions/object", async (t) => {
  await t.step({
    name: "OBJECT00",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: { x: 7, y: 11 },
      expression: {
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
      },
    }),
  });

  await t.step({
    name: "OBJECT01",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: { x: 11 },
      expression: {
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
      },
    }),
  });

  await t.step({
    name: "OBJECT02",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: {},
      expression: {
        kind: ExpressionKind.Object,
        keys: [],
      },
    }),
  });

  await t.step({
    name: "OBJECT03",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: { x: 7, y: 11 },
      expression: {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { x: 7, y: 11 },
            },
          },
        ],
      },
    }),
  });

  await t.step({
    name: "OBJECT04",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: { x: 7, y: 13, z: 19 },
      expression: {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { x: 7, y: 11 },
            },
          },
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { y: 13, z: 19 },
            },
          },
        ],
      },
    }),
  });

  await t.step({
    name: "OBJECT05",
    fn: expressionTest({
      match: Match.Default(Scope.Default()),
      result: { x: 13, y: 11, z: 19 },
      expression: {
        kind: ExpressionKind.Object,
        keys: [
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { x: 7, y: 11 },
            },
          },
          {
            kind: ExpressionKind.ObjectKey,
            name: "x",
            expression: {
              kind: ExpressionKind.Value,
              value: 13,
            },
          },
          {
            kind: ExpressionKind.ObjectSpread,
            expression: {
              kind: ExpressionKind.Value,
              value: { z: 19 },
            },
          },
        ],
      },
    }),
  });
});
