import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { executeUffdaSource } from "./execute.ts";
import { MorseLang } from "./morse.lang.ts";

const MORSE_REPERTOIRE = [
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

Deno.test("lang.uffda.morse-lang compiles and translates Morse input", async (t) => {
  await t.step("decodes the complete supported repertoire", async () => {
    const input = MORSE_REPERTOIRE.map(([code]) => `${code}/`).join("");
    const expected = MORSE_REPERTOIRE.map(([, symbol]) => symbol).join("");
    const match = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(input),
    });

    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, expected);
    }
  });

  await t.step("decodes SOS", async () => {
    const match = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(".../---/.../"),
    });
    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, "SOS");
    }
  });

  await t.step("unsupported Morse input fails", async () => {
    const match = await executeUffdaSource(MorseLang, {
      entryRuleName: "Morse",
      input: Input.Iterable(".-"),
    });
    assertEquals(match.kind, MatchKind.Fail);
  });
});
