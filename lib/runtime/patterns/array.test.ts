import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.array", () => [
  {
    id: "ARRAY00",
    description: "matches explicit empty array",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Any },
      },
    }),
    input: [[]],
  },
  {
    id: "ARRAY01",
    description: "matches array with 1 item",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: { kind: PatternKind.Any },
    }),
    input: [["a"]],
    value: "a",
  },
  {
    id: "ARRAY02",
    description: "matches array with 2 item",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
    }),
    input: [["a", "b"]],
    value: ["a", "b"],
  },
  {
    id: "ARRAY03",
    description: "slicing an array with 2 item matches all items",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: {
        kind: PatternKind.Slice,
        pattern: { kind: PatternKind.Any },
      },
    }),
    input: [["a", "b"]],
    value: ["a", "b"],
  },
  {
    id: "ARRAY04",
    description: "fails if all items in array are not matched",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: { kind: PatternKind.Any },
    }),
    input: [["a", "b"]],
    value: "a",
    matched: false,
    done: false,
  },
  {
    id: "ARRAY05",
    description: "matches array with an array",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: {
        kind: PatternKind.Array,
        pattern: { kind: PatternKind.Any },
      },
    }),
    input: [[["a"]]],
    value: "a",
  },
  {
    id: "ARRAY06",
    description: "match outside of array fails",
    pattern: () => ({
      kind: PatternKind.Array,
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
    }),
    input: [["a"], "b"],
    matched: false,
    done: false,
  },
]);
