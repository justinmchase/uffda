import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "GROUP00",
    pattern: () => PatternLang,
    input: "(a)",
    value: { kind: LangPatternKind.ReferencePattern, name: "a" },
  },
  {
    id: "GROUP01",
    pattern: () => PatternLang,
    input: "(a & b) | c",
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: LangPatternKind.AndPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "a",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "b",
        },
      },
      right: { kind: LangPatternKind.ReferencePattern, name: "c" },
    },
  },
  {
    id: "GROUP02",
    pattern: () => PatternLang,
    input: "(a | (b & c)) | d",
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: LangPatternKind.OrPattern,
        left: { kind: LangPatternKind.ReferencePattern, name: "a" },
        right: {
          kind: LangPatternKind.AndPattern,
          left: { kind: LangPatternKind.ReferencePattern, name: "b" },
          right: { kind: LangPatternKind.ReferencePattern, name: "c" },
        },
      },
      right: { kind: LangPatternKind.ReferencePattern, name: "d" },
    },
  },
]);
