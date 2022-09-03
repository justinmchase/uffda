import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "GROUP00",
    pattern: () => TestLang,
    input: "(a)",
    value: { kind: LangPatternKind.ReferencePattern, name: "a" },
  },
  {
    id: "GROUP01",
    pattern: () => TestLang,
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
    pattern: () => TestLang,
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
