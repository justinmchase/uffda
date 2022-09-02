import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "EQUAL00",
    description: "'a'",
    pattern: () => TestLang,
    input: "'a'",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: "a",
    },
  },
  {
    id: "EQUAL01",
    description: "1",
    pattern: () => TestLang,
    input: "1",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: 1,
    },
  },
]);
