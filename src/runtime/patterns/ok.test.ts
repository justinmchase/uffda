import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/ok", async (t) => {
  await t.step({
    name: "OK00",
    fn: patternTest({
      pattern: { kind: PatternKind.Ok },
      input: Input.From([]),
    }),
  });

  await t.step({
    name: "OK01",
    fn: patternTest({
      pattern: { kind: PatternKind.Ok },
      input: Input.From("a"),
      done: false,
    }),
  });
});
