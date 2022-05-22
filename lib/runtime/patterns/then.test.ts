import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(import.meta.url, () => [
  {
    id: "THEN00",
    description: "no patterns is success",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [],
    }),
    input: [],
    value: [],
  },
  {
    id: "THEN01",
    description: "reads one pattern successfuly",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [{ kind: PatternKind.Any }],
    }),
    input: "a",
    value: ["a"],
  },
  {
    id: "THEN02",
    description: "reads two patterns successfuly",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    }),
    input: "ab",
    value: ["a", "b"],
  },
  {
    id: "THEN03",
    description: "does not read too much",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    }),
    input: "abc",
    value: ["a", "b"],
    done: false,
  },
  {
    id: "THEN04",
    description: "it doesnt fail if at the end",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Ok },
      ],
    }),
    input: [],
    value: [undefined],
  },
  {
    id: "THEN05",
    description: "it fails if it reaches the end",
    pattern: () => ({
      kind: PatternKind.Then,
      patterns: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Any },
      ],
    }),
    input: "a",
    matched: false,
  },
]);
