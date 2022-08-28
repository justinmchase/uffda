import { PatternKind } from "../../runtime/patterns/mod.ts";
import { tests } from "../../test.ts";
import { Tokenizer } from "../tokenizer/mod.ts";
import { Exclude } from "./Exclude.ts";

tests(import.meta.url, () => [
  {
    id: "EXCLUDE00",
    description: "can exclude whitespace and newlines",
    pattern: () => ({
      kind: PatternKind.Pipeline,
      steps: [
        Tokenizer,
        Exclude({ types: ["Whitespace", "Newline"] }),
      ],
    }),
    input: "x + y",
    value: [
      { type: "Identifier", value: "x" },
      { type: "Token", value: "+" },
      { type: "Identifier", value: "y" },
    ],
  },
]);
