import { Input } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/end", async (t) => {
  await t.step({
    name: "END00",
    fn: patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.From([]),
    }),
  });

  await t.step({
    name: "END01",
    fn: patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.From("a"),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "END02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: {
          kind: PatternKind.End,
        },
      },
      input: Input.From("a"),
      matched: true,
      done: false,
    }),
  });
});
