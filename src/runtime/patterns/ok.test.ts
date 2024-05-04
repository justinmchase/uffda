import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/ok", async (t) => {
  await t.step({
    name: "OK00",
    fn: patternTest({
      pattern: { kind: PatternKind.Ok },
      input: Input.From([]),
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OK01",
    fn: patternTest({
      pattern: { kind: PatternKind.Ok },
      input: Input.From("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  });
});
