import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(import.meta.url, () => [
  {
    id: "REGEXP00",
    description: "can match strings with a regexp",
    pattern: () => ({
      kind: PatternKind.RegExp,
      pattern: /a/,
    }),
    input: "a",
    value: "a",
  },
  {
    id: "REGEXP01",
    description: "cannot match non-strings with a regexp",
    pattern: () => ({
      kind: PatternKind.RegExp,
      pattern: /a/,
    }),
    input: [1],
    matched: false,
    done: false,
  },
  {
    id: "REGEXP02",
    description: "consumes a single value",
    pattern: () => ({
      kind: PatternKind.RegExp,
      pattern: /a/,
    }),
    input: "aa",
    value: "a",
    done: false,
  },
]);
