import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(import.meta.url, () => [
  {
    id: "REFERENCE00",
    description: "can reference other pattern",
    pattern: () => ({
      kind: PatternKind.Block,
      rules: {
        A: {
          kind: PatternKind.Rule,
          pattern: { kind: PatternKind.Equal, value: "a" },
        },
        Main: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Reference,
            name: "A",
          },
        },
      },
    }),
    input: "a",
    value: "a",
  },
]);
