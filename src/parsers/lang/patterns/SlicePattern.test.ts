import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { SlicePattern } from "./SlicePattern.ts";

tests(() => [
  {
    id: "SLICE00",
    module: () => SlicePattern,
    input: [
      // "x+"
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "+" },
    ],
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
    module: () => SlicePattern,
    input: [
      // "x*"
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
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
    module: () => SlicePattern,
    input: [
      // "x?"
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "?" },
    ],
    value: {
      kind: LangPatternKind.ZeroOrOnePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
