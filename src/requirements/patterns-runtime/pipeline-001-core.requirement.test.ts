import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:pipeline-001 - Pipeline feeds each step from previous step output", () => {
  return patternTest({
    pattern: {
      kind: PatternKind.Pipeline,
      steps: [
        { kind: PatternKind.Any },
        { kind: PatternKind.Equal, value: 1 },
      ],
    },
    input: Input.Iterable([1]),
    kind: MatchKind.Ok,
    value: 1,
  })();
});
