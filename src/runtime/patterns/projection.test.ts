import { tests } from "../../test.ts";
import { Scope } from "../../scope.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => {
  const $0 = () => 11;
  return [
    {
      id: "PROJECTION00",
      description: "calls expression on match",
      pattern: () => ({
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => 11,
        },
      }),
      input: [7],
      value: 11,
    },
    {
      id: "PROJECTION01",
      description: "provides variables as an argument",
      pattern: () => ({
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ v0 }) => v0,
        },
      }),
      input: Scope.From([7]).addVariables({ v0: 11 }),
      value: 11,
    },
    {
      id: "PROJECTION02",
      description: "provides projections as an argument",
      pattern: () => ({
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ $0 }) => $0(),
        },
      }),
      input: Scope.From([7]).addVariables({ $0 }),
      value: 11,
    },
  ];
});
