import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:and-001 - And is a zero-width conjunction over child patterns", async (t) => {
  await t.step(
    "and succeeds when all children succeed without direct consumption",
    patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.And,
            patterns: [{ kind: PatternKind.Any }, { kind: PatternKind.Any }],
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("ab"),
      kind: MatchKind.Ok,
      value: ["a", "b"],
    }),
  );
});
