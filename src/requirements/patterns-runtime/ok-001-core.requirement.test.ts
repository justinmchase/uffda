import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:ok-001 - Ok always succeeds and never consumes input", () => {
  return patternTest({
    pattern: { kind: PatternKind.Ok },
    input: Input.Iterable("a"),
    kind: MatchKind.Ok,
    done: false,
  })();
});
