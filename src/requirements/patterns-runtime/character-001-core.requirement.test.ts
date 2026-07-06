import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { CharacterClass } from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:character-001 - Character matches one string item against the declared character class", async (t) => {
  await t.step(
    "character class match succeeds and consumes one item",
    patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Letter,
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  );

  await t.step(
    "character mismatch fails without consumption",
    patternTest({
      pattern: {
        kind: PatternKind.Character,
        characterClass: CharacterClass.Letter,
      },
      input: Input.Iterable("1"),
      kind: MatchKind.Fail,
      done: false,
    }),
  );
});
