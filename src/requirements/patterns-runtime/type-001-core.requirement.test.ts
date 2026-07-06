import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:type-001 - Type matches one item by runtime type", async (t) => {
  await t.step(
    "type succeeds on matching runtime type",
    patternTest({
      pattern: { kind: PatternKind.Type, type: Type.Number },
      input: Input.Iterable([7]),
      kind: MatchKind.Ok,
      value: 7,
    }),
  );

  await t.step(
    "type fails on mismatched runtime type",
    patternTest({
      pattern: { kind: PatternKind.Type, type: Type.Number },
      input: Input.Iterable(["7"]),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
