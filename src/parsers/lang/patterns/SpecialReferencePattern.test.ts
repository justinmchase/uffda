import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { SpecialReferencePattern } from "./SpecialReferencePattern.ts";

tests(() => [
  {
    id: "SPECREF00",
    module: () => SpecialReferencePattern,
    input: [
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" }
    ],
    value: {
      kind: LangPatternKind.SpecialReferencePattern,
      name: "$0",
    },
  },
]);
