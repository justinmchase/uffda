import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:then-001 - Then composes child patterns sequentially", async (t) => {
  await t.step(
    "then succeeds for ordered matching sequence",
    patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: "a" },
          { kind: PatternKind.Equal, value: "b" },
        ],
      },
      input: Input.Iterable("ab"),
      kind: MatchKind.Ok,
      value: ["a", "b"],
    }),
  );

  await t.step(
    "then fails when a child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: "a" },
          { kind: PatternKind.Equal, value: "x" },
        ],
      },
      input: Input.Iterable("ab"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
