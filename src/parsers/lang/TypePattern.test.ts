import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "TYPE00",
    pattern: () => TestLang,
    input: "string",
    value: {
      kind: LangPatternKind.StringPattern,
    },
  },
  {
    id: "TYPE01",
    pattern: () => TestLang,
    input: "boolean",
    value: {
      kind: LangPatternKind.BooleanPattern,
    },
  },
  
  {
    id: "TYPE00",
    pattern: () => TestLang,
    input: "number",
    value: {
      kind: LangPatternKind.NumberPattern,
    },
  },
]);
