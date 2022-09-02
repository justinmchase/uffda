import { tests } from "../../test.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => [
  {
    id: "PIPELINE00",
    description: "succeeds with single step",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        { kind: PatternKind.Any },
      ],
    }),
    input: "a",
    value: "a",
  },
  {
    id: "PIPELINE01",
    description: "succeeds with two steps",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        {
          kind: PatternKind.Projection,
          pattern: { kind: PatternKind.Any },
          expression: {
            kind: ExpressionKind.Native,
            fn: () => 1,
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: { kind: PatternKind.Any },
          expression: {
            kind: ExpressionKind.Native,
            fn: () => 2,
          },
        },
      ],
    }),
    input: [0],
    value: 2,
  },
  {
    id: "PIPELINE02",
    description: "output of previous step is input of next step",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Slice,
            pattern: { kind: PatternKind.Any },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => _.map((n: number) => n + 1),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Slice,
            pattern: { kind: PatternKind.Any },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => _.map((n: number) => n * 2),
          },
        },
      ],
    }),
    input: [1, 2, 3],
    value: [4, 6, 8],
  },
  {
    id: "PIPELINE03",
    description: "non-iterable output is wrapped in an iterable for next step",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        { kind: PatternKind.Any },
        {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Slice,
            pattern: { kind: PatternKind.Any },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => _.map((n: number) => n * 2),
          },
        },
      ],
    }),
    input: [11],
    value: [22],
  },
  {
    id: "PIPELINE04",
    description:
      "non-iterable output of final step is not wrapped in an iterable for final output",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Slice,
            pattern: { kind: PatternKind.Any },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => _.reduce((i: number, n: number) => i + n, 0),
          },
        },
      ],
    }),
    input: [1, 2, 3],
    value: 6,
  },
  {
    id: "PIPELINE05",
    description: "can have a pipeline as a step",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        {
          kind: PatternKind.Pipeline,
          steps: [
            {
              kind: PatternKind.Slice,
              pattern: { kind: PatternKind.Any },
            },
          ],
        },
        {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Slice,
            min: 3,
            max: 3,
            pattern: { kind: PatternKind.Any },
          },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => _.join("-"),
          },
        },
      ],
    }),
    input: "abc",
    value: "a-b-c",
  },
]);
