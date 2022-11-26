import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { AnyPattern } from "./AnyPattern.ts";

tests(() => [
  {
    id: "ANY00",
    module: () => AnyPattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "any" },
    ],
    value: {
      kind: LangPatternKind.AnyPattern,
    },
  },
]);
