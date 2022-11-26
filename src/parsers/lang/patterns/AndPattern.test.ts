import { tests } from "../../../test.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { AndPattern } from "./AndPattern.ts";
import { TokenizerKind } from "../../mod.ts";

tests(() => [
  {
    id: "LANG.PATTERN.AND00",
    module: () => AndPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "&" },
      { kind: TokenizerKind.Identifier, value: "y" },
    ],
    value: {
      kind: LangPatternKind.AndPattern,
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
]);
