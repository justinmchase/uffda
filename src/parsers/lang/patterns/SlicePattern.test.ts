import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "SLICE00",
    pattern: () => PatternLang,
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
    pattern: () => PatternLang,
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
    pattern: () => PatternLang,
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
