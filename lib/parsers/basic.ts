import { IRulePattern, PatternKind } from "../runtime/patterns/mod.ts";
import { Exclude } from "./exclusion/mod.ts";
import { Tokenizer } from "./tokenizer/mod.ts";

export const Basic: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Tokenizer,
      Exclude: Exclude({ types: ["Whitespace", "NewLine"] }),
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "Tokenizer" },
            { kind: PatternKind.Reference, name: "Exclude" },
          ],
        },
      },
    },
  },
};
