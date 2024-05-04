import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/fail", async (t) => {
  await t.step({
    name: "FAIL00",
    fn: patternTest({
      pattern: { kind: PatternKind.Fail },
      input: Input.From("a"),
      kind: MatchKind.Fail,
    }),
  });
});
