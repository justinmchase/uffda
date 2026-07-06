import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:fail-001 - Fail always fails and never consumes input", () => {
  return patternTest({
    pattern: { kind: PatternKind.Fail },
    input: Input.Iterable("a"),
    kind: MatchKind.Fail,
    done: false,
  })();
});
