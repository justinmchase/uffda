import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts"
import { LangPatternKind } from "./lang.pattern.ts";

tests(import.meta.url, () => [
  {
    id: "STRINGPATTERN00",
    description: "Can parse strings",
    pattern: () => TestLang,
    input: "'abc'",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: "abc",
    },
  },
]);
