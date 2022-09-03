import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "OK00",
    description: "ok",
    pattern: () => TestLang,
    input: "ok",
    value: {
      kind: LangPatternKind.OkPattern,
    },
  },
]);
