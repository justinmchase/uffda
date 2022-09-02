import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "ANY00",
    description: "any",
    pattern: () => TestLang,
    input: "any",
    value: {
      kind: LangPatternKind.AnyPattern,
    },
  },
]);
