import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ThenPattern } from "./ThenPattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.THEN01",
    module: () => ThenPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Identifier, value: "y" },
    ],
    value: {
      kind: LangPatternKind.ThenPattern,
      left: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
      right: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    },
  },
  {
    id: "LANG.PATTERN.THEN02",
    module: () => ThenPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Identifier, value: "z" },
    ],
    value: {
      kind: LangPatternKind.ThenPattern,
      left: {
        kind: LangPatternKind.VariablePattern,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
      right: {
        kind: LangPatternKind.ReferencePattern,
        name: "z",
      },
    },
  },
]);
