import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.type", () => [
  {
    id: "TYPE00",
    description: "reads a string successfully",
    pattern: () => ({ kind: PatternKind.String }),
    input: ["a"],
    value: "a",
  },
  {
    id: "TYPE01",
    description: "does not read a non-string",
    pattern: () => ({ kind: PatternKind.String }),
    input: [7],
    matched: false,
    done: false,
  },
  {
    id: "TYPE02",
    description: "reads a number successfully",
    pattern: () => ({ kind: PatternKind.Number }),
    input: [7],
    value: 7,
  },
  {
    id: "TYPE03",
    description: "does not read a non-number",
    pattern: () => ({ kind: PatternKind.Number }),
    input: ["a"],
    matched: false,
    done: false,
  },
  {
    id: "TYPE04",
    description: "boolean",
    pattern: () => ({ kind: PatternKind.Boolean }),
    input: [true],
    value: true,
  },
  {
    id: "TYPE05",
    description: "boolean",
    pattern: () => ({ kind: PatternKind.Boolean }),
    input: [7],
    matched: false,
    done: false,
  },
]);
