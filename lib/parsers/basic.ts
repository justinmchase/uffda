import { Pattern, PatternKind } from "../runtime/patterns/mod.ts";
import { Exclude } from "./exclusion/mod.ts";
import { Tokenizer } from "./tokenizer/mod.ts";

export const Basic: Pattern = {
  kind: PatternKind.Block,
  variables: {
    Tokenizer,
    Exclude: Exclude({ types: ["Whitespace", "NewLine"] }),
    Main: {
      kind: PatternKind.Pipeline,
      steps: [
        { kind: PatternKind.Reference, name: "Tokenizer" },
        { kind: PatternKind.Reference, name: "Exclude" },
      ],
    },
  },
};
