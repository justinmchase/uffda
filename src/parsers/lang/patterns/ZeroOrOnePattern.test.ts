import { tests } from "../../../test.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ZeroOrOnePattern } from "./ZeroOrOnePattern.ts";
import { TokenizerKind } from "../../mod.ts";

tests(() => [
  {
    id: "ZERORONE00",
    module: () => ZeroOrOnePattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "?" },
    ],
    value: {
      kind: LangPatternKind.ZeroOrOnePattern,
      pattern: {
        kind: "ReferencePattern",
        name: "a",
      },
    },
  },
]);
