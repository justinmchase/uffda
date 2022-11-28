import { tests } from "../../test.ts";
import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => [
  {
    id: "REFERENCE00",
    trace: true,
    description: "can reference other pattern",
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [
        {
          kind: DeclarationKind.Rule,
          name: "A",
          pattern: { kind: PatternKind.Equal, value: "a" },
        },
        {
          kind: DeclarationKind.Rule,
          name: "Main",
          pattern: {
            kind: PatternKind.Reference,
            name: "A",
          },
        },
      ],
    }),
    input: "a",
    value: "a",
  },
]);
