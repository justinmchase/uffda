import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "NUMBER00",
    description: "1",
    pattern: () => TestLang,
    input: "1",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: 1,
    },
  },
]);
