import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "REF00",
    description: "Can parse reference",
    pattern: () => TestLang,
    input: "a",
    value: {
      kind: LangPatternKind.ReferencePattern,
      name: "a",
    },
  },
]);
