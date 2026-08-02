import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource, MorseLang } from "../../lang/uffda/uffda.lang.ts";

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
