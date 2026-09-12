// Traces to
// `.agents/requirements/uffda-runtime-compilation/006-canonical-morse-language.requirement.md`.
// Relocated here (from `src/requirements/uffda-runtime-compilation/`) because
// it's a slow, full-compile integration test — see `test/integration/README.md`.

import { assertEquals } from "@std/assert";
import { Input } from "../../src/input.ts";
import { MatchKind } from "../../src/match.ts";
import { executeUffdaSource } from "../../src/lang/uffda/uffda.lang.ts";

const MorseLang = await Deno.readTextFile(
  new URL("../../examples/morse/morse.uff", import.meta.url),
);

Deno.test("req:uffda-runtime-compilation-006 - source-authored Morse targets the Uffda runtime", async () => {
  const repertoire = [
    [".-", "A"],
    ["-...", "B"],
    ["-.-.", "C"],
    ["-..", "D"],
    [".", "E"],
    ["..-.", "F"],
    ["--.", "G"],
    ["....", "H"],
    ["..", "I"],
    [".---", "J"],
    ["-.-", "K"],
    [".-..", "L"],
    ["--", "M"],
    ["-.", "N"],
    ["---", "O"],
    [".--.", "P"],
    ["--.-", "Q"],
    [".-.", "R"],
    ["...", "S"],
    ["-", "T"],
    ["..-", "U"],
    ["...-", "V"],
    [".--", "W"],
    ["-..-", "X"],
    ["-.--", "Y"],
    ["--..", "Z"],
    ["-----", "0"],
    [".----", "1"],
    ["..---", "2"],
    ["...--", "3"],
    ["....-", "4"],
    [".....", "5"],
    ["-....", "6"],
    ["--...", "7"],
    ["---..", "8"],
    ["----.", "9"],
    [".-.-.-", "."],
    ["--..--", ","],
    ["..--..", "?"],
    [".----.", "'"],
    ["-.-.--", "!"],
    ["-..-.", "/"],
    ["-.--.", "("],
    ["-.--.-", ")"],
    [".-...", "&"],
    ["---...", ":"],
    ["-.-.-.", ";"],
    ["-...-", "="],
    [".-.-.", "+"],
    ["-....-", "-"],
    ["..--.-", "_"],
    [".-..-.", '"'],
    ["...-..-", "$"],
    [".--.-.", "@"],
  ] as const;
  const match = await executeUffdaSource(MorseLang, {
    entryRuleName: "Morse",
    input: Input.Iterable(
      repertoire.map(([code]) => `${code}/`).join(""),
    ),
  });

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(
      match.value,
      repertoire.map(([, symbol]) => symbol).join(""),
    );
  }
});
