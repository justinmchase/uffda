import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "MUST00",
    description: "x!",
    pattern: () => TestLang,
    input: "x!",
    value: {
      kind: LangPatternKind.MustPattern,
      name: "PatternExpected",
      description: "ReferencePattern is expected",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
