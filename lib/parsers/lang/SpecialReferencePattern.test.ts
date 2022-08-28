import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(import.meta.url, () => [
  {
    id: "SPECREF00",
    description: "Can parse special reference",
    pattern: () => TestLang,
    input: "$0",
    value: {
      kind: LangPatternKind.SpecialReferencePattern,
      name: "$0",
    },
  },
]);
