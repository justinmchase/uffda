import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(import.meta.url, () => [
  {
    id: "ONEORMORE00",
    description: "parse one or more reference",
    pattern: () => TestLang,
    input: "x+",
    value: {
      kind: LangPatternKind.OneOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
