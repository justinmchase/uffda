import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests("patterns.reference", () => [
  {
    id: "REFERENCE00",
    description: "can reference other pattern",
    pattern: () => ({
      kind: PatternKind.Block,
      variables: {
        A: { kind: PatternKind.Equal, value: "a" },
        Main: { kind: PatternKind.Reference, name: "A" },
      },
    }),
    input: "a",
    value: "a",
  },
]);
