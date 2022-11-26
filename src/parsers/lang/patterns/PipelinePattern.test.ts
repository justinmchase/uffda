import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { PipelinePattern } from "./PipelinePattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.PIPELINE00",
    description: "it can pipe two steps",
    module: () => PipelinePattern,
    input: [
      // "x > y"
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "y" },
    ],
    value: {
      kind: LangPatternKind.PipelinePattern,
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
