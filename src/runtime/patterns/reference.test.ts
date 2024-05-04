import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { PatternKind } from "./pattern.kind.ts";

Deno.test("runtime.patterns.reference", async (t) => {
  await t.step({
    name: "REFERENCE00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
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
        },
      },
      input: Input.From("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });
});
