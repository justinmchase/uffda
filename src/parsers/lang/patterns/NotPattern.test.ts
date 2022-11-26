import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { NotPattern } from "./NotPattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.NOT00",
    module: () => NotPattern,
    input: [
      { kind: TokenizerKind.Token, value: "^" },
      { kind: TokenizerKind.Identifier, value: "x" },
    ],
    value: {
      kind: LangPatternKind.NotPattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
