import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { VariablePattern } from "./VariablePattern.ts";

tests(() => [
  {
    id: "VARIABLEPATTERN00",
    description: "can parse a reference as a variable",
    module: () => VariablePattern,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ":" },
      { kind: TokenizerKind.Identifier, value: "y" },
    ],
    value: {
      kind: LangPatternKind.VariablePattern,
      name: "x",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    },
  },
]);
