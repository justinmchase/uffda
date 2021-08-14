import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.or", () => [
  {
    id: "OR00",
    description: "requires at least one pattern to match",
    pattern: () => ({
      kind: PatternKind.Or,
      patterns: [],
    }),
    input: [],
    matched: false,
  },
  {
    id: "OR01",
    description: "matches with a single pattern",
    pattern: () => ({
      kind: PatternKind.Or,
      patterns: [
        { kind: PatternKind.Any },
      ],
    }),
    input: "a",
    value: "a",
  },
  {
    id: "OR02",
    description: "matches second pattern",
    pattern: () => ({
      kind: PatternKind.Or,
      patterns: [
        { kind: PatternKind.Equal, value: 1 },
        { kind: PatternKind.Equal, value: 2 },
      ],
    }),
    input: [2],
    value: 2,
  },
  {
    id: "OR03",
    description: "fails if no pattern matches",
    pattern: () => ({
      kind: PatternKind.Or,
      patterns: [
        { kind: PatternKind.Equal, value: 1 },
        { kind: PatternKind.Equal, value: 2 },
      ],
    }),
    input: [3],
    matched: false,
    done: false,
  },
  {
    id: "OR04",
    description: "consumes only a single input",
    pattern: () => ({
      kind: PatternKind.Or,
      patterns: [
        { kind: PatternKind.Equal, value: 1 },
      ],
    }),
    input: [1, 2],
    value: 1,
    done: false,
  },
]);
