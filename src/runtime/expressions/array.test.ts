import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "RUNTIME.ARRAY00",
    match: Match.Default(Scope.Default().addVariables({
      a: 7,
      b: 11,
    })),
    description: "a:[] b:[] -> [a b]",
    result: [7, 11],
    expression: () => ({
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
    }),
  },
  {
    id: "RUNTIME.ARRAY01",
    match: Match.Default(Scope.Default()),
    description: "[]",
    result: [],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [],
    }),
  },
  {
    id: "RUNTIME.ARRAY02",
    match: Match.Default(Scope.Default().addVariables({
      a: [],
    })),
    description: "a:[] -> [a]",
    result: [[[]]],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArrayElement,
          expression: {
            kind: ExpressionKind.Array,
            expressions: [
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Reference,
                  name: "a",
                },
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: "RUNTIME.ARRAY03",
    match: Match.Default(Scope.Default()),
    description: "[...[7 11]]",
    result: [7, 11],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArraySpread,
          expression: {
            kind: ExpressionKind.Array,
            expressions: [
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 7,
                },
              },
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 11,
                },
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: "RUNTIME.ARRAY04",
    match: Match.Default(Scope.Default()),
    description: "[[7 11] ...[13]]",
    result: [[7, 11], 13],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArrayElement,
          expression: {
            kind: ExpressionKind.Array,
            expressions: [
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 7,
                },
              },
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 11,
                },
              },
            ],
          },
        },
        {
          kind: ExpressionKind.ArraySpread,
          expression: {
            kind: ExpressionKind.Array,
            expressions: [
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 13,
                },
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: "RUNTIME.ARRAY05",
    match: Match.Default(Scope.Default()),
    description: "[[] ...[7 11]]",
    result: [[], 7, 11],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArrayElement,
          expression: {
            kind: ExpressionKind.Value,
            value: [],
          },
        },
        {
          kind: ExpressionKind.ArraySpread,
          expression: {
            kind: ExpressionKind.Array,
            expressions: [
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 7,
                },
              },
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 11,
                },
              },
            ],
          },
        },
      ],
    }),
  },
  {
    id: "RUNTIME.ARRAY06",
    match: Match.Default(Scope.Default()),
    description: "[...[...[7 11] 13]]",
    result: [7, 11, 13],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.ArraySpread,
          expression: {
            kind: ExpressionKind.Array,
            expressions: [
              {
                kind: ExpressionKind.ArraySpread,
                expression: {
                  kind: ExpressionKind.Array,
                  expressions: [
                    {
                      kind: ExpressionKind.ArrayElement,
                      expression: {
                        kind: ExpressionKind.Value,
                        value: 7,
                      },
                    },
                    {
                      kind: ExpressionKind.ArrayElement,
                      expression: {
                        kind: ExpressionKind.Value,
                        value: 11,
                      },
                    },
                  ],
                },
              },
              {
                kind: ExpressionKind.ArrayElement,
                expression: {
                  kind: ExpressionKind.Value,
                  value: 13,
                },
              },
            ],
          },
        },
      ],
    }),
  },
]);
