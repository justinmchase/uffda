import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:or-001 - Or succeeds with the first successful child and preserves input on full failure", async (t) => {
  await t.step(
    "or succeeds on first successful branch",
    patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: "x" },
          { kind: PatternKind.Equal, value: "a" },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "or fails when all branches fail without input consumption",
    patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          { kind: PatternKind.Equal, value: "x" },
          { kind: PatternKind.Equal, value: "y" },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
