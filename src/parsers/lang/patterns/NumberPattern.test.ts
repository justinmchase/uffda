import { tests } from "../../../test.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { NumberPattern } from "./NumberPattern.ts";
import { TokenizerKind } from "../../mod.ts";

tests(() => [
  {
    id: "LANG.PATTERN.NUMBER00",
    module: () => NumberPattern,
    input: [
      { kind: TokenizerKind.Integer, value: 1 },
    ],
    value: {
      kind: LangPatternKind.EqualPattern,
      value: 1,
    },
  },
]);
