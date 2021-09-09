import { tests } from "../../test.ts";
import { TestLang } from "./Lang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests("parsers.lang.specialreference", () => [
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
