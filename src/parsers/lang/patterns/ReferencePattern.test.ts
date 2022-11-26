import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ReferencePattern } from "./ReferencePattern.ts";

tests(() => [
  {
    id: "REF00",
    module: () => ReferencePattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
    ],
    value: {
      kind: LangPatternKind.ReferencePattern,
      name: "a",
    },
  },
  
  {
    id: "REF01",
    module: () => ReferencePattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "_" },
    ],
    value: {
      kind: LangPatternKind.ReferencePattern,
      name: "_",
    },
  },
]);
