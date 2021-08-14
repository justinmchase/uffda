import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.any", () => [
  {
    id: "ANY00",
    description: "reads string successfully",
    pattern: () => ({ kind: PatternKind.Any }),
    input: "a",
    value: "a",
  },
  {
    id: "ANY01",
    description: "reads array successfully",
    pattern: () => ({ kind: PatternKind.Any }),
    input: ["a"],
    value: "a",
  },
  {
    id: "ANY02",
    description: "fails to read empty stream",
    pattern: () => ({ kind: PatternKind.Any }),
    input: "",
    matched: false,
  },
  {
    id: "ANY03",
    description: "reads example 1 input",
    pattern: () => ({ kind: PatternKind.Any }),
    input: "ab",
    value: "a",
    done: false,
  },
]);
