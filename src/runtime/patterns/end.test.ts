import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => [
  {
    id: "END00",
    pattern: () => ({ kind: PatternKind.End }),
    input: [],
  },
  {
    id: "END01",
    pattern: () => ({ kind: PatternKind.End }),
    input: "a",
    matched: false,
    done: false,
  },
  {
    id: "END02",
    pattern: () => ({
      kind: PatternKind.Not,
      pattern: {
        kind: PatternKind.End,
      },
    }),
    input: "a",
    done: false,
  },
]);
