import { tests } from "../../../test.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ZeroOrMorePattern } from "./ZeroOrMorePattern.ts";
import { TokenizerKind } from "../../mod.ts";

tests(() => [
  {
    id: "ZERORMROE00",
    description: "can parse a*",
    module: () => ZeroOrMorePattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "*" },
    ],
    value: {
      kind: LangPatternKind.ZeroOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "a",
      },
    },
  },
]);
