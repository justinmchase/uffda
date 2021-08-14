import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.and", () => [
  {
    id: "AND00",
    description: "and pattern matches with single pattern",
    pattern: () => ({
      kind: PatternKind.And,
      patterns: [
        { kind: PatternKind.Any },
      ],
    }),
    input: "a",
    value: "a",
  },
  {
    id: "AND01",
    description: "pattern matches with two patterns",
    pattern: () => ({
      kind: PatternKind.And,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    }),
    input: "a",
    value: "a",
  },
  {
    id: "AND02",
    description: "and pattern only consumes a single input",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.And,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Any },
          ],
        },
        { kind: PatternKind.Any },
      ],
    }),
    input: "ab",
    value: ["a", "b"],
  },
  {
    id: "AND03",
    description: "fails if first pattern fails",
    pattern: () => ({
      kind: PatternKind.And,
      patterns: [
        { kind: PatternKind.RegExp, pattern: /b/ },
        { kind: PatternKind.RegExp, pattern: /a/ },
      ],
    }),
    input: "a",
    matched: false,
    done: false,
  },
  {
    id: "AND04",
    description: "fails if second pattern fails",
    pattern: () => ({
      kind: PatternKind.And,
      patterns: [
        { kind: PatternKind.RegExp, pattern: /b/ },
        { kind: PatternKind.RegExp, pattern: /a/ },
      ],
    }),
    input: "a",
    matched: false,
    done: false,
  },
]);
