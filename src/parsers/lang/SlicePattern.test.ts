import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "SLICE00",
    pattern: () => TestLang,
    input: "x+",
    value: {
      kind: LangPatternKind.OneOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
  {
    id: "SLICE01",
    pattern: () => TestLang,
    input: "x*",
    value: {
      kind: LangPatternKind.ZeroOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
  {
    id: "SLICE02",
    pattern: () => TestLang,
    input: "x?",
    value: {
      kind: LangPatternKind.ZeroOrOnePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
