import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { MustPattern } from "./MustPattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.MUST00",
    description: "x!",
    module: () => MustPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "!" },
    ],
    value: {
      kind: LangPatternKind.MustPattern,
      name: "PatternExpected",
      description: "ReferencePattern is expected",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
