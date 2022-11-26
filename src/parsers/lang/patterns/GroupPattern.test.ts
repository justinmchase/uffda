import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { GroupPattern } from "./GroupPattern.ts";

tests(() => [
  {
    id: "GROUP00",
    module: () => GroupPattern,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: { kind: LangPatternKind.ReferencePattern, name: "a" },
  },
  {
    id: "GROUP01",
    module: () => GroupPattern,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "&" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "c" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
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
    module: () => GroupPattern,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "&" },
      { kind: TokenizerKind.Identifier, value: "c" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "d" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
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
