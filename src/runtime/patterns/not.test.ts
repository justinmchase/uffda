import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(import.meta.url, () => [
  {
    id: "NOT00",
    description: "^ok",
    pattern: () => ({
      kind: PatternKind.Not,
      pattern: { kind: PatternKind.Ok },
    }),
    input: [],
    matched: false,
  },
  {
    id: "NOT01",
    description: "^fail",
    pattern: () => ({
      kind: PatternKind.Not,
      pattern: { kind: PatternKind.Fail },
    }),
    input: [],
  },
  {
    id: "NOT02",
    description: "^^ok",
    pattern: () => ({
      kind: PatternKind.Not,
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Ok },
      },
    }),
    input: [],
  },
  {
    id: "NOT03",
    description: "^fail",
    pattern: () => ({
      kind: PatternKind.Not,
      pattern: { kind: PatternKind.Fail },
    }),
    input: "a",
    done: false,
  },
]);
