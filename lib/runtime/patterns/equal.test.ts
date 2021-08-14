import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.equal", () => [
  {
    id: "EQUAL00",
    description: "matches exact string",
    pattern: () => ({
      kind: PatternKind.Equal,
      value: "a",
    }),
    input: "a",
    value: "a",
  },
  {
    id: "EQUAL01",
    description: "matches exact number",
    pattern: () => ({
      kind: PatternKind.Equal,
      value: 7,
    }),
    input: [7],
    value: 7,
  },
  {
    id: "EQUAL02",
    description: "fails to match wrong number",
    pattern: () => ({
      kind: PatternKind.Equal,
      value: 7,
    }),
    input: [11],
    matched: false,
    done: false,
  },
]);
