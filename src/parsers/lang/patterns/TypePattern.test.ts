import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { TypePattern } from "./TypePattern.ts";

tests(() => [
  {
    id: "TYPE00",
    module: () => TypePattern,
    input: [
      // "string"
      { kind: TokenizerKind.Identifier, value: "string" },
    ],
    value: {
      kind: LangPatternKind.StringPattern,
    },
  },
  {
    id: "TYPE01",
    module: () => TypePattern,
    input: [
      // "boolean"
      { kind: TokenizerKind.Identifier, value: "boolean" },
    ],
    value: {
      kind: LangPatternKind.BooleanPattern,
    },
  },

  {
    id: "TYPE00",
    module: () => TypePattern,
    input: [
      // "number"
      { kind: TokenizerKind.Identifier, value: "number" },
    ],
    value: {
      kind: LangPatternKind.NumberPattern,
    },
  },
]);
